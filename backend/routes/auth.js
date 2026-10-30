
const express = require("express");
const pool = require("../config/db");
const {
  hashPassword,
  verifyPassword,
} = require("../utils/password");

const jwt = require("jsonwebtoken");

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


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role, is_active
       FROM public.app_users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    const user = result.rows[0];

    // Use the same response for unknown emails and incorrect passwords.
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await verifyPassword(
      password,
      user.password_hash
    );

    if (!passwordMatches || !user.is_active) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        error: "Authentication service is not configured",
      });
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "15m",
        issuer: "ecosync-api",
        audience: "ecosync-client",
      }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "15m",
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      error: "Unable to process login",
    });
  }
});


module.exports = router;
