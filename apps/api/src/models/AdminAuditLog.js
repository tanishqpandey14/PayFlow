import mongoose from "mongoose";

const adminAuditLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    targetType: {
      type: String,
      required: true,
      enum: ["User", "Wallet", "Transfer", "RiskFlag"],
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const AdminAuditLog = mongoose.model(
  "AdminAuditLog",
  adminAuditLogSchema
);

export default AdminAuditLog;