
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const crypto = require("crypto");

const pool = require("./config/db");
const supabase = require("./config/supabase");
const authRoutes = require("./routes/auth");
const {
  authenticateToken,
  authorizeRoles,
} = require("./middleware/auth");

const {
  uploadPhotos,
  validateImageContents
} = require("./middleware/upload");




const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authRoutes);

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

app.get(
  "/api/reports",
  authenticateToken,
  async (req, res) => {
    try {
      let query;
      let values = [];

      if (req.user.role === "reporter") {
        query = `
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
          WHERE reporter_id = $1
          ORDER BY created_at DESC
        `;

        values = [req.user.id];
      } else if (
        req.user.role === "waste_management_team" ||
        req.user.role === "system_administrator"
      ) {
        query = `
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
        `;
      } else {
        return res.status(403).json({
          error: "You do not have permission to view reports"
        });
      }

      const result = await pool.query(query, values);

      return res.status(200).json({
        count: result.rows.length,
        reports: result.rows
      });
    } catch (error) {
      console.error("Failed to retrieve waste reports:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve waste reports"
      });
    }
  }
);




 // GET one report by ID from PostgreSQL

app.get(
  "/api/reports/:id",
  authenticateToken,
  async (req, res) => {
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

      const report = result.rows[0];

      if (
        req.user.role === "reporter" &&
        String(report.reporter_id) !== req.user.id
      ) {
        return res.status(403).json({
          error: "You do not have permission to access this report"
        });
      }

      if (
        req.user.role !== "reporter" &&
        req.user.role !== "waste_management_team" &&
        req.user.role !== "system_administrator"
      ) {
        return res.status(403).json({
          error: "You do not have permission to access this report"
        });
      }

      return res.status(200).json({
        report
      });
    } catch (error) {
      console.error("Failed to retrieve waste report:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve waste report"
      });
    }
  }
);

app.get(
  "/api/reports/:id/photos",
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;

    // Validate report ID
    if (!/^\d+$/.test(id) || id === "0") {
      return res.status(400).json({
        error: "Report ID must be a positive integer"
      });
    }

    try {
      // Find the report and its owner
      const reportResult = await pool.query(
        `SELECT id, reporter_id
         FROM public.waste_reports
         WHERE id = $1`,
        [id]
      );

      if (reportResult.rows.length === 0) {
        return res.status(404).json({
          error: "Waste report not found"
        });
      }

      const report = reportResult.rows[0];

      // Check whether this user can access the report
      if (
        req.user.role === "reporter" &&
        String(report.reporter_id) !== req.user.id
      ) {
        return res.status(403).json({
          error: "You do not have permission to access these photos"
        });
      }

      if (
        ![
          "reporter",
          "waste_management_team",
          "system_administrator"
        ].includes(req.user.role)
      ) {
        return res.status(403).json({
          error: "You do not have permission to access these photos"
        });
      }

      // Retrieve photo metadata
      const photoResult = await pool.query(
        `SELECT
           id,
           storage_path,
           original_filename,
           mime_type,
           file_size_bytes,
           created_at AS "createdAt"
         FROM public.waste_report_photos
         WHERE report_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      const bucket = process.env.SUPABASE_BUCKET;

      if (!bucket) {
        throw new Error("Supabase bucket configuration is missing");
      }

      // Generate a temporary signed URL for each photo
      const photos = await Promise.all(
        photoResult.rows.map(async (photo) => {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(photo.storage_path, 300);

          if (error) {
            throw error;
          }

          return {
            id: photo.id,
            filename: photo.original_filename,
            mimeType: photo.mime_type,
            fileSizeBytes: photo.file_size_bytes,
            createdAt: photo.createdAt,
            signedUrl: data.signedUrl,
            expiresInSeconds: 300
          };
        })
      );

      return res.status(200).json({
        reportId: report.id,
        count: photos.length,
        photos
      });

    } catch (error) {
      console.error("Failed to retrieve report photos:", error.message);

      return res.status(500).json({
        error: "Unable to retrieve report photos"
      });
    }
  }
);

app.patch(
  "/api/reports/:id/status",
  authenticateToken,
  authorizeRoles("waste_management_team", "system_administrator"),
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!/^\d+$/.test(id) || id === "0") {
      return res.status(400).json({
        error: "Report ID must be a positive integer"
      });
    }

    const allowedTransitions = {
      pending: ["verified", "rejected"],
      verified: ["assigned", "rejected"],
      assigned: ["collected"],
      collected: [],
      rejected: []
    };

    if (
      typeof status !== "string" ||
      !Object.prototype.hasOwnProperty.call(
        allowedTransitions,
        status
      )
    ) {
      return res.status(400).json({
        error: "Invalid report status"
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT id, status
         FROM public.waste_reports
         WHERE id = $1
         FOR UPDATE`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Waste report not found"
        });
      }

      const currentStatus = result.rows[0].status;

      if (!allowedTransitions[currentStatus].includes(status)) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          error: `Cannot change report status from ${currentStatus} to ${status}`
        });
      }

      const updatedResult = await client.query(
        `UPDATE public.waste_reports
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, status, updated_at AS "updatedAt"`,
        [status, id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        message: "Waste report status updated successfully",
        report: updatedResult.rows[0]
      });

    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Status update failed:", error.message);

      return res.status(500).json({
        error: "Unable to update waste report status"
      });

    } finally {
      client.release();
    }
  }
);
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
  authenticateToken,
  authorizeRoles("reporter"),
  receivePhotos,
  validateImageContents,
  async (req, res) => {
    const body = req.body || {};

    // The reporter identity comes from verified authentication.
    const reporterId = req.user.id;

    // Multipart form values arrive as strings.
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);

    const wasteAmount = body.wasteAmount;
    const roadCondition = body.roadCondition;
    const description = body.description ?? "";

    const files = req.files || [];

    // Validate latitude.
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

    // Validate longitude.
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

    // Validate waste amount.
    if (!WASTE_AMOUNTS.includes(wasteAmount)) {
      return res.status(400).json({
        error: "Waste amount must be low, medium, or high"
      });
    }

    // Validate road condition.
    if (!ROAD_CONDITIONS.includes(roadCondition)) {
      return res.status(400).json({
        error: "Road condition must be good, damaged, blocked, or unknown"
      });
    }

    // Validate description.
    if (
      typeof description !== "string" ||
      description.length > 500
    ) {
      return res.status(400).json({
        error: "Description must be text with at most 500 characters"
      });
    }

    const bucket = process.env.SUPABASE_BUCKET;

    if (!bucket) {
      console.error("SUPABASE_BUCKET is not configured");

      return res.status(500).json({
        error: "Photo storage is not configured"
      });
    }

    const uploadedPaths = [];

    let client;
    let transactionStarted = false;

    try {
      // Acquire database connection.
      client = await pool.connect();

      // Start database transaction.
      await client.query("BEGIN");
      transactionStarted = true;

      // Create waste report.
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

      // Upload photos to private Supabase storage.
      for (const file of files) {
        const extension = extensions[file.mimetype];

        if (!extension) {
          throw new Error("Unsupported image format");
        }

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

        // Save photo metadata in PostgreSQL.
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

      // Commit database transaction.
      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(201).json({
        message: "Waste report created successfully",
        report,
        photos: savedPhotos
      });

    } catch (error) {
      console.error(
        "Failed to create waste report:",
        error.message
      );

      // Roll back database changes.
      if (client && transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Database rollback failed:",
            rollbackError.message
          );
        }
      }

      // Remove uploaded photos if database operation fails.
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
          error: "The authenticated reporter account does not exist"
        });
      }

      return res.status(500).json({
        error: "Unable to create waste report and its photos"
      });

    } finally {
      if (client) {
        client.release();
      }
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

app.get(
  "/api/auth/me",
  authenticateToken,
  (req, res) => {
    res.status(200).json({
      message: "Authentication successful",
      user: req.user,
    });
  }
);

app.get(
  "/api/auth/admin-test",
  authenticateToken,
  authorizeRoles("system_administrator"),
  (req, res) => {
    res.json({
      message: "Administrator access granted",
      user: req.user,
    });
  }
);


// Start server
app.listen(PORT, () => {
  console.log(
    `EcoSync API running at http://localhost:${PORT}`
  );
});
