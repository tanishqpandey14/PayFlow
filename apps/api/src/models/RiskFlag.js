import mongoose from "mongoose";

const riskFlagSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    transfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      default: null,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
    },

    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed"],
      default: "open",
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const RiskFlag = mongoose.model("RiskFlag", riskFlagSchema);

export default RiskFlag;