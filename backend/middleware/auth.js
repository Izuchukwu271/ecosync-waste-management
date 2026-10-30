
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      error: "Authentication required",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "ecosync-api",
      audience: "ecosync-client",
      algorithms: ["HS256"],
    });

    const result = await pool.query(
      `SELECT id, full_name, email, role, is_active
       FROM public.app_users
       WHERE id = $1`,
      [decoded.sub]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
      return res.status(401).json({
        error: "Account is unavailable",
      });
    }

    req.user = {
      id: String(user.id),
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError" ||
        error.name === "NotBeforeError") {
      return res.status(401).json({
        error: "Invalid or expired access token",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      error: "Authentication service unavailable",
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "You do not have permission to perform this action",
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles,
};
