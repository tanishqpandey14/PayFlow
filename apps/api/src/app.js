
import express from "express";
import cors from "cors";
import helmet from "helmet";

import { env } from "./config/env.js";
import { AppError } from "./utils/AppError.js";

import healthRouter from "./routes/health.routes.js";
import authRouter from "./routes/auth.routes.js";
import walletRouter from "./routes/wallet.routes.js";
import transferRouter from "./routes/transfer.routes.js";
import adminRouter from "./routes/admin.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.webOrigin,
  })
);

app.use(express.json({ limit: "10kb" }));

// API routes
app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/wallet", walletRouter);
app.use("/api/v1/transfers", transferRouter);
app.use("/api/v1/admin", adminRouter);

// Handle unknown routes
app.use((req, res, next) => {
  next(new AppError("Route not found", 404));
});

// Centralized error handler
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error instanceof AppError;

  if (!isOperational) {
    console.error("UNEXPECTED ERROR:", error);
  }

  return res.status(statusCode).json({
    error: {
      message: isOperational
        ? error.message
        : "Internal server error",
    },
  });
});

export default app;