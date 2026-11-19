
import { Router } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

import { User, Wallet } from "../models/index.js";
import { env } from "../config/env.js";
import {
  hashPassword,
  comparePassword,
} from "../utils/password.js";
import { validatePassword } from "../utils/validatePassword.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

// Register a new user and create their wallet.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields.
    if (!name || !email || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    // Validate name.
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        error: "Name must be at least 2 characters long",
      });
    }

    // Validate email.
    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        error: "Please provide a valid email address",
      });
    }

    // Validate password.
    const passwordResult = validatePassword(password);

    if (!passwordResult.valid) {
      return res.status(400).json({
        error: passwordResult.message,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check whether the email is already registered.
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    // Hash the password before storing it.
    const passwordHash = await hashPassword(password);

    // Start a MongoDB session.
    const session = await mongoose.startSession();

    let user;

    try {
      // Execute user and wallet creation atomically.
      await session.withTransaction(async () => {
        const [createdUser] = await User.create(
          [
            {
              name: name.trim(),
              email: normalizedEmail,
              passwordHash,
            },
          ],
          { session }
        );

        user = createdUser;

        await Wallet.create(
          [
            {
              user: user._id,
              currency: "INR",
              balance: 0,
            },
          ],
          { session }
        );
      });
    } finally {
      // Always release the session.
      await session.endSession();
    }

    return res.status(201).json({
      message: "Account created successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "An account with this email already exists",
      });
    }

    next(error);
  }
});

// Log in an existing user.
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

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

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    // Use the same response for an unknown email and incorrect password.
    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const passwordMatches = await comparePassword(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      { sub: user._id.toString() },
      env.jwtSecret,
      {
        expiresIn: "1h",
        issuer: "payflow-api",
        audience: "payflow-web",
      }
    );

    return res.status(200).json({
      message: "Login successful",
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get the currently authenticated user's profile.
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.status(200).json({
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;