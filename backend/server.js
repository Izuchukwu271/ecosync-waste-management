
const express = require("express");
const cors = require("cors");
require("dotenv").config();

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
app.post("/api/reports", async (req, res) => {
  const {
    reporterId,
    latitude,
    longitude,
    wasteAmount,
    roadCondition,
    description = ""
  } = req.body || {};

  // Development-only reporter identity.
  // Production must obtain this from authenticated user credentials.
  if (
    !Number.isSafeInteger(reporterId) ||
    reporterId <= 0
  ) {
    return res.status(400).json({
      error: "A valid reporterId is required for development testing"
    });
  }

  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    return res.status(400).json({
      error: "Latitude must be a number between -90 and 90"
    });
  }

  if (
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return res.status(400).json({
      error: "Longitude must be a number between -180 and 180"
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

  try {
    const result = await pool.query(
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

    res.status(201).json({
      message: "Waste report created successfully",
      report: result.rows[0]
    });
  } catch (error) {
    console.error("Failed to create waste report:", error.message);

    if (error.code === "23503") {
      return res.status(400).json({
        error: "The specified reporter does not exist"
      });
    }

    res.status(500).json({
      error: "Unable to create waste report"
    });
  }
});

// Handle malformed JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      error: "Invalid JSON request body"
    });
  }

  next(err);
});


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
