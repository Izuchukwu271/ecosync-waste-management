
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const crypto = require("crypto");

const pool = require("./config/db");
const supabase = require("./config/supabase");

const {
  uploadPhotos,
  validateImageContents
} = require("./middleware/upload");


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Temporary storage. PostgreSQL will replace this later.
const reports = [];

// Allowed values keep report data consistent.
const WASTE_AMOUNTS = ["low", "medium", "high"];
const ROAD_CONDITIONS = [
  "good",
  "damaged",
  "blocked",
  "unknown"
];

// Welcome endpoint
app.get("/", (req, res) => {
  res.json({
    name: "EcoSync Waste Management API",
    status: "running"
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    service: "ecosync-api",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});


 // GET all reports from PostgreSQL
app.get("/api/reports", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        reporter_id,
        waste_description AS description,
        waste_amount AS "wasteAmount",
        road_condition AS "roadCondition",
        ST_Y(location::geometry) AS latitude,
        ST_X(location::geometry) AS longitude,
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM public.waste_reports
      ORDER BY created_at DESC
    `);

    res.status(200).json({
      count: result.rows.length,
      reports: result.rows
    });
  } catch (error) {
    console.error("Failed to retrieve waste reports:", error.message);

    res.status(500).json({
      error: "Unable to retrieve waste reports"
    });
  }
});



 // GET one report by ID from PostgreSQL
app.get("/api/reports/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id) || id === "0") {
    return res.status(400).json({
      error: "Report ID must be a positive integer"
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          id,
          reporter_id,
          waste_description AS description,
          waste_amount AS "wasteAmount",
          road_condition AS "roadCondition",
          ST_Y(location::geometry) AS latitude,
          ST_X(location::geometry) AS longitude,
          status,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM public.waste_reports
        WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Waste report not found"
      });
    }

    res.status(200).json({
      report: result.rows[0]
    });
  } catch (error) {
    console.error("Failed to retrieve waste report:", error.message);

    res.status(500).json({
      error: "Unable to retrieve waste report"
    });
  }
});


 // POST a new report to PostgreSQL

const receivePhotos = (req, res, next) => {
  uploadPhotos.array("photos", 3)(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: "Each photo must be 5 MB or smaller"
        });
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          error: "You can upload a maximum of 3 photos"
        });
      }

      return res.status(400).json({
        error: error.message || "Invalid photo upload"
      });
    }

    next();
  });
};

app.post(
  "/api/reports",
  receivePhotos,
  validateImageContents,
  async (req, res) => {
    const body = req.body || {};

    // Multipart form values arrive as strings.
    const reporterId = Number(body.reporterId);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    const wasteAmount = body.wasteAmount;
    const roadCondition = body.roadCondition;
    const description = body.description ?? "";

    const files = req.files || [];

    if (
      typeof body.reporterId === "undefined" ||
      String(body.reporterId).trim() === "" ||
      !Number.isSafeInteger(reporterId) ||
      reporterId <= 0
    ) {
      return res.status(400).json({
        error: "A valid reporterId is required for development testing"
      });
    }

    if (
      typeof body.latitude === "undefined" ||
      String(body.latitude).trim() === "" ||
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90
    ) {
      return res.status(400).json({
        error: "Latitude must be between -90 and 90"
      });
    }

    if (
      typeof body.longitude === "undefined" ||
      String(body.longitude).trim() === "" ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return res.status(400).json({
        error: "Longitude must be between -180 and 180"
      });
    }

    if (!WASTE_AMOUNTS.includes(wasteAmount)) {
      return res.status(400).json({
        error: "Waste amount must be low, medium, or high"
      });
    }

    if (!ROAD_CONDITIONS.includes(roadCondition)) {
      return res.status(400).json({
        error: "Road condition must be good, damaged, blocked, or unknown"
      });
    }

    if (
      typeof description !== "string" ||
      description.length > 500
    ) {
      return res.status(400).json({
        error: "Description must be text with at most 500 characters"
      });
    }

    const bucket = process.env.SUPABASE_BUCKET;
    const uploadedPaths = [];
    const client = await pool.connect();

    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const reportResult = await client.query(
        `
          INSERT INTO public.waste_reports (
            reporter_id,
            waste_description,
            waste_amount,
            road_condition,
            location
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography
          )
          RETURNING
            id,
            reporter_id,
            waste_description AS description,
            waste_amount AS "wasteAmount",
            road_condition AS "roadCondition",
            ST_Y(location::geometry) AS latitude,
            ST_X(location::geometry) AS longitude,
            status,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          reporterId,
          description.trim() || null,
          wasteAmount,
          roadCondition,
          longitude,
          latitude
        ]
      );

      const report = reportResult.rows[0];
      const savedPhotos = [];

      const extensions = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
      };

      for (const file of files) {
        const extension = extensions[file.mimetype];

        if (!extension) {
          throw new Error("Unsupported image format");
        }

        // Never use the original filename as the storage key.
        const storagePath =
          `${report.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          throw new Error("A photo could not be uploaded to storage");
        }

        uploadedPaths.push(storagePath);

        const photoResult = await client.query(
          `
            INSERT INTO public.waste_report_photos (
              report_id,
              storage_path,
              original_filename,
              mime_type,
              file_size_bytes
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
              id,
              report_id AS "reportId",
              storage_path AS "storagePath",
              original_filename AS "originalFilename",
              mime_type AS "mimeType",
              file_size_bytes AS "fileSizeBytes",
              created_at AS "createdAt"
          `,
          [
            report.id,
            storagePath,
            file.originalname.split(/[\\/]/).pop().slice(0, 255),
            file.mimetype,
            file.size
          ]
        );

        savedPhotos.push(photoResult.rows[0]);
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message: "Waste report created successfully",
        report,
        photos: savedPhotos
      });
    } catch (error) {
      console.error("Failed to create waste report:", error.message);

      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Database rollback failed:", rollbackError.message);
        }
      }

      if (uploadedPaths.length > 0) {
        try {
          const { error: cleanupError } = await supabase.storage
            .from(bucket)
            .remove(uploadedPaths);

          if (cleanupError) {
            console.error(
              "Photo cleanup failed; manual cleanup may be needed."
            );
          }
        } catch (cleanupError) {
          console.error("Photo cleanup failed.");
        }
      }

      if (error.code === "23503") {
        return res.status(400).json({
          error: "The specified reporter does not exist"
        });
      }

      return res.status(500).json({
        error: "Unable to create waste report and its photos"
      });
    } finally {
      client.release();
    }
  }
);

app.get("/api/health/database", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        PostGIS_Version() AS postgis_version
    `);

    res.status(200).json({
      status: "healthy",
      database: result.rows[0].database_name,
      postgis: result.rows[0].postgis_version
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "unhealthy",
      message: "Database connection failed"
    });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(
    `EcoSync API running at http://localhost:${PORT}`
  );
});
