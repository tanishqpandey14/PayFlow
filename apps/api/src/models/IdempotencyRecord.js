import mongoose from "mongoose";

const idempotencyRecordSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requestHash: {
      type: String,
      required: true,
    },

    transfer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transfer",
      default: null,
    },

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
  },
  {
    timestamps: true,
  }
);

idempotencyRecordSchema.index(
  { user: 1, key: 1 },
  { unique: true }
);

const IdempotencyRecord = mongoose.model(
  "IdempotencyRecord",
  idempotencyRecordSchema
);

export default IdempotencyRecord;