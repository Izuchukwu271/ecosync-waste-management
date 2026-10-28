
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware: prepare the server to receive JSON requests.
app.use(cors());
app.use(express.json());

// Basic route to confirm that the API is running.
app.get("/", (req, res) => {
  res.json({
    message: "Distributed Waste Management System API",
    status: "running"
  });
});

// Health endpoint: useful for checking service availability.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    service: "waste-management-api",
    status: "healthy",
    timestamp: new Date().toISOString()
  });
});

// Start the backend server.
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
