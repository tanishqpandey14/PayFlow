
import mongoose from "mongoose";

const transferSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Amount must be a safe integer in paise",
      },
    },

    currency: {
      type: String,
      enum: ["INR"],
      default: "INR",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    reference: {
      type: String,
      required: true,
      unique: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent transfers between the same wallet.
transferSchema.pre("validate", function () {
  if (
    this.sender &&
    this.receiver &&
    this.sender.equals(this.receiver)
  ) {
    this.invalidate(
      "receiver",
      "Sender and receiver wallets must be different"
    );
  }
});

const Transfer = mongoose.model("Transfer", transferSchema);

export default Transfer;
