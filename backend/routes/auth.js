
const express = require("express");
const pool = require("../config/db");
const { hashPassword } = require("../utils/password");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body || {};

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        error: "Full name, email, and password are required",
      });
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (
      normalizedName.length < 2 ||
      normalizedName.length > 150
    ) {
      return res.status(400).json({
        error: "Full name must be between 2 and 150 characters",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        error: "Enter a valid email address",
      });
    }

    if (password.length < 12 || password.length > 72) {
      return res.status(400).json({
        error: "Password must be between 12 and 72 characters",
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO public.app_users
         (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'reporter')
       RETURNING id, full_name, email, role, created_at`,
      [normalizedName, normalizedEmail, passwordHash]
    );

    return res.status(201).json({
      message: "Registration successful",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    console.error("Registration failed:", error.message);

    return res.status(500).json({
      error: "Unable to register account",
    });
  }
});

module.exports = router;
