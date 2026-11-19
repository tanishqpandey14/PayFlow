
import { Router } from "express";
import mongoose from "mongoose";

import { RiskFlag, AdminAuditLog } from "../models/index.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeRole } from "../middleware/authorize.middleware.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

router.use(authenticateToken, authorizeRole("admin"));

// GET /api/v1/admin/risk-flags
router.get("/risk-flags", async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const { status, severity } = req.query;

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        error: { message: "Invalid pagination parameters" },
      });
    }

    const filter = {};

    if (status) {
      if (!["open", "reviewed", "dismissed"].includes(status)) {
        return res.status(400).json({
          error: { message: "Invalid status filter" },
        });
      }
      filter.status = status;
    }

    if (severity) {
      if (!["low", "medium", "high"].includes(severity)) {
        return res.status(400).json({
          error: { message: "Invalid severity filter" },
        });
      }
      filter.severity = severity;
    }

    const [riskFlags, total] = await Promise.all([
      RiskFlag.find(filter)
        .populate("user", "name email")
        .populate("transfer", "reference amount currency status")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      RiskFlag.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: {
        riskFlags,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/admin/risk-flags/:id
router.get("/risk-flags/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        error: { message: "Invalid risk flag ID" },
      });
    }

    const riskFlag = await RiskFlag.findById(id)
      .populate("user", "name email")
      .populate("transfer", "reference amount currency status")
      .lean();

    if (!riskFlag) {
      return res.status(404).json({
        error: { message: "Risk flag not found" },
      });
    }

    return res.status(200).json({
      data: { riskFlag },
    });
  } catch (error) {
    next(error);
  }
});

// Shared review/dismiss implementation.
async function updateRiskFlag(req, res, next, newStatus) {
  const { id } = req.params;
  const { reason } = req.body ?? {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      error: { message: "Invalid risk flag ID" },
    });
  }

  if (
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.trim().length > 300
  ) {
    return res.status(400).json({
      error: {
        message: "A reason between 3 and 300 characters is required",
      },
    });
  }

  const session = await mongoose.startSession();

  try {
    let updatedRiskFlag;

    await session.withTransaction(async () => {
      updatedRiskFlag = await RiskFlag.findOneAndUpdate(
        { _id: id, status: "open" },
        {
          $set: {
            status: newStatus,
            reviewedAt: new Date(),
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updatedRiskFlag) {
        const existing = await RiskFlag.findById(id).session(session);

        if (!existing) {
          throw new AppError("Risk flag not found", 404);
        }

        throw new AppError(
          "Risk flag has already been processed",
          409
        );
      }

      await AdminAuditLog.create(
        [
          {
            admin: req.user.id,
            action:
              newStatus === "reviewed"
                ? "RISK_FLAG_REVIEWED"
                : "RISK_FLAG_DISMISSED",
            targetType: "RiskFlag",
            targetId: updatedRiskFlag._id,
            reason: reason.trim(),
            metadata: {
              previousStatus: "open",
              newStatus,
              severity: updatedRiskFlag.severity,
            },
          },
        ],
        { session }
      );
    });

    return res.status(200).json({
      message: `Risk flag ${newStatus} successfully`,
      data: { riskFlag: updatedRiskFlag },
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
}

// PATCH /api/v1/admin/risk-flags/:id/review
router.patch("/risk-flags/:id/review", (req, res, next) =>
  updateRiskFlag(req, res, next, "reviewed")
);

// PATCH /api/v1/admin/risk-flags/:id/dismiss
router.patch("/risk-flags/:id/dismiss", (req, res, next) =>
  updateRiskFlag(req, res, next, "dismissed")
);

export default router;