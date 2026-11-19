import { Router } from "express";
import mongoose from "mongoose";

const router = Router();

router.get("/", (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    data: {
      status: databaseConnected ? "ok" : "not_ready",
      service: "payflow-api",
      mode: "simulation",
      database: databaseConnected ? "connected" : "disconnected",
    },
  });
});

export default router;
