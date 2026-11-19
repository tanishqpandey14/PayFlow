import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { User } from "../models/index.js";

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication token is required",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: "payflow-api",
      audience: "payflow-web",
    });

    const user = await User.findById(decoded.sub).select("_id role");

    if (!user) {
      return res.status(401).json({
        error: "User account no longer exists",
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Invalid or expired authentication token",
      });
    }

    next(error);
  }
}