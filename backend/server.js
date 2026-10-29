
const express = require("express");
const cors = require("cors");
const { randomUUID } = require("crypto");
require("dotenv").config();

const pool = require("./config/db");


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

// GET all reports
app.get("/api/reports", (req, res) => {
  res.status(200).json({
    count: reports.length,
    reports
  });
});

// GET one report by ID
app.get("/api/reports/:id", (req, res) => {
  const report = reports.find(
    (item) => item.id === req.params.id
  );

  if (!report) {
    return res.status(404).json({
      error: "Waste report not found"
    });
  }

  res.status(200).json({ report });
});

// POST a new report
app.post("/api/reports", (req, res) => {
  const {
    area,
    latitude,
    longitude,
    wasteAmount,
    roadCondition,
    description = ""
  } = req.body || {};

  // Validate required fields
  if (
    typeof area !== "string" ||
    area.trim().length === 0
  ) {
    return res.status(400).json({
      error: "Area is required"
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

  const report = {
    id: randomUUID(),
    area: area.trim(),
    latitude,
    longitude,
    wasteAmount,
    roadCondition,
    description: description.trim(),
    createdAt: new Date().toISOString()
  };

  reports.push(report);

  res.status(201).json({
    message: "Waste report created successfully",
    report
  });
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
