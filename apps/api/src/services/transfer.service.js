import mongoose from "mongoose";
import crypto from "node:crypto";

import { AppError } from "../utils/AppError.js";

import {
  User,
  Wallet,
  Transfer,
  LedgerEntry,
  IdempotencyRecord,
  RiskFlag,
} from "../models/index.js";

// Validate and normalize the transfer request.
function validateTransferInput({
  receiverEmail,
  amount,
  idempotencyKey,
  description = "",
}) {
  if (
    typeof receiverEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail.trim())
  ) {
    throw new AppError("A valid receiver email is required", 400);
  }

  if (
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    throw new AppError("Amount must be a positive integer in paise", 400);
  }

  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.trim().length < 8 ||
    idempotencyKey.trim().length > 128
  ) {
    throw new AppError("A valid idempotency key is required", 400);
  }

  if (typeof description !== "string" || description.length > 200) {
    throw new AppError("Description must not exceed 200 characters", 400);
  }

  return {
    receiverEmail: receiverEmail.trim().toLowerCase(),
    amount,
    idempotencyKey: idempotencyKey.trim(),
    description: description.trim(),
  };
}

// Generate a consistent hash of the request details.
function createRequestHash({ receiverEmail, amount, description }) {
  const requestData = JSON.stringify({
    receiverEmail,
    amount,
    description,
  });

  return crypto.createHash("sha256").update(requestData).digest("hex");
}

// Check specifically for a duplicate idempotency key.
function isIdempotencyDuplicateError(error) {
  if (error?.code !== 11000) {
    return false;
  }

  if (error?.keyPattern) {
    return error.keyPattern.user === 1 && error.keyPattern.key === 1;
  }

  return (
    typeof error?.message === "string" && error.message.includes("user_1_key_1")
  );
}

// Find the result of a previously completed request.
// Retry briefly because another transaction may still be committing.
async function findExistingTransfer({ userId, idempotencyKey, requestHash }) {
  const maxAttempts = 10;
  const retryDelayMs = 100;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const existingRecord = await IdempotencyRecord.findOne({
      user: userId,
      key: idempotencyKey,
    });

    if (existingRecord) {
      if (existingRecord.requestHash !== requestHash) {
        throw new AppError(
          "Idempotency key has already been used with different request details",
          409,
        );
      }

      if (existingRecord.status !== "completed") {
        throw new AppError(
          "A request with this idempotency key is already processing",
          409,
        );
      }

      const transfer = await Transfer.findById(existingRecord.transfer);

      if (!transfer) {
        throw new AppError("Previously completed transfer was not found", 500);
      }

      return transfer;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
}

// Reserve an idempotency key for this user.
async function reserveIdempotencyKey({
  userId,
  idempotencyKey,
  requestHash,
  session,
}) {
  const existingRecord = await IdempotencyRecord.findOne({
    user: userId,
    key: idempotencyKey,
  }).session(session);

  if (existingRecord) {
    if (existingRecord.requestHash !== requestHash) {
      throw new AppError(
        "Idempotency key has already been used with different request details",
        409,
      );
    }

    if (existingRecord.status === "completed") {
      return {
        isDuplicate: true,
        transferId: existingRecord.transfer,
      };
    }

    throw new AppError(
      "A request with this idempotency key is already processing",
      409,
    );
  }

  await IdempotencyRecord.create(
    [
      {
        user: userId,
        key: idempotencyKey,
        requestHash,
        status: "processing",
      },
    ],
    { session },
  );

  return {
    isDuplicate: false,
    transferId: null,
  };
}

// Atomically debit the sender's wallet.
async function debitWallet({ walletId, amount, session }) {
  const wallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      status: "active",
      balance: { $gte: amount },
    },
    {
      $inc: { balance: -amount },
    },
    {
      new: true,
      session,
      runValidators: true,
    },
  );

  if (!wallet) {
    throw new AppError(
      "Sender wallet is inactive or has insufficient funds",
      400,
    );
  }

  return wallet;
}

// Atomically credit the receiver's wallet.
async function creditWallet({ walletId, amount, session }) {
  const wallet = await Wallet.findOneAndUpdate(
    {
      _id: walletId,
      status: "active",
      balance: {
        $lte: Number.MAX_SAFE_INTEGER - amount,
      },
    },
    {
      $inc: { balance: amount },
    },
    {
      new: true,
      session,
      runValidators: true,
    },
  );

  if (!wallet) {
    throw new AppError(
      "Receiver wallet is inactive or its balance limit would be exceeded",
      400,
    );
  }

  return wallet;
}

// Create the transfer summary and its two ledger entries.
async function createTransferRecords({
  senderWalletId,
  receiverWalletId,
  amount,
  description,
  session,
}) {
  const reference = `PF-${crypto.randomUUID()}`;

  const [transfer] = await Transfer.create(
    [
      {
        sender: senderWalletId,
        receiver: receiverWalletId,
        amount,
        currency: "INR",
        status: "completed",
        reference,
        description,
      },
    ],
    { session },
  );

  await LedgerEntry.create(
    [
      {
        transfer: transfer._id,
        wallet: senderWalletId,
        type: "debit",
        amount,
        currency: "INR",
      },
      {
        transfer: transfer._id,
        wallet: receiverWalletId,
        type: "credit",
        amount,
        currency: "INR",
      },
    ],
    {
      session,
      ordered: true,
    },
  );

  return transfer;
}

// Detect suspicious activity and save risk flags.
// This function runs inside the transfer's MongoDB transaction.
async function detectAndCreateRiskFlags({
  senderUserId,
  senderWalletId,
  transfer,
  amount,
  session,
}) {
  const riskFlags = [];

  // Rule 1: Large transfers (₹25,000 or more).
  // Amounts are stored in paise.
  const LARGE_TRANSFER_THRESHOLD = 2_500_000;

  if (amount >= LARGE_TRANSFER_THRESHOLD) {
    riskFlags.push({
      user: senderUserId,
      transfer: transfer._id,
      reason: "Large transfer detected: amount is ₹25,000 or more",
      severity: "high",
    });
  }

  // Rule 2: Five or more outgoing transfers within ten minutes.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const recentTransferCount = await Transfer.countDocuments({
    sender: senderWalletId,
    status: "completed",
    createdAt: { $gte: tenMinutesAgo },
  }).session(session);

  if (recentTransferCount >= 5) {
    riskFlags.push({
      user: senderUserId,
      transfer: transfer._id,
      reason: "Rapid transfers detected: 5 or more transfers within 10 minutes",
      severity: "medium",
    });
  }

  if (riskFlags.length > 0) {
    await RiskFlag.create(riskFlags, { session });
  }
}

// Execute a complete wallet-to-wallet transfer.
export async function executeTransfer({
  senderUserId,
  receiverEmail,
  amount,
  idempotencyKey,
  description = "",
}) {
  if (!mongoose.Types.ObjectId.isValid(senderUserId)) {
    throw new AppError("Invalid sender user ID", 400);
  }

  const input = validateTransferInput({
    receiverEmail,
    amount,
    idempotencyKey,
    description,
  });

  const requestHash = createRequestHash(input);
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(async () => {
      const reservation = await reserveIdempotencyKey({
        userId: senderUserId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
        session,
      });

      // A completed retry returns its original transfer.
      if (reservation.isDuplicate) {
        result = await Transfer.findById(reservation.transferId).session(
          session,
        );

        if (!result) {
          throw new AppError(
            "Previously completed transfer was not found",
            500,
          );
        }

        return;
      }

      const senderWallet = await Wallet.findOne({
        user: senderUserId,
      }).session(session);

      if (!senderWallet) {
        throw new AppError("Sender wallet not found", 404);
      }

      const receiverUser = await User.findOne({
        email: input.receiverEmail,
      }).session(session);

      if (!receiverUser) {
        throw new AppError("Recipient account not found", 404);
      }

      const receiverWallet = await Wallet.findOne({
        user: receiverUser._id,
      }).session(session);

      if (!receiverWallet) {
        throw new AppError("Recipient wallet not found", 404);
      }

      if (senderWallet._id.equals(receiverWallet._id)) {
        throw new AppError("You cannot transfer money to yourself", 400);
      }

      await debitWallet({
        walletId: senderWallet._id,
        amount: input.amount,
        session,
      });

      await creditWallet({
        walletId: receiverWallet._id,
        amount: input.amount,
        session,
      });

      const transfer = await createTransferRecords({
        senderWalletId: senderWallet._id,
        receiverWalletId: receiverWallet._id,
        amount: input.amount,
        description: input.description,
        session,
      });

      await detectAndCreateRiskFlags({
        senderUserId,
        senderWalletId: senderWallet._id,
        transfer,
        amount: input.amount,
        session,
      });

      await IdempotencyRecord.updateOne(
        {
          user: senderUserId,
          key: input.idempotencyKey,
        },
        {
          $set: {
            transfer: transfer._id,
            status: "completed",
          },
        },
        { session },
      );

      result = transfer;
    });

    return result;
  } catch (error) {
    if (isIdempotencyDuplicateError(error)) {
      const existingTransfer = await findExistingTransfer({
        userId: senderUserId,
        idempotencyKey: input.idempotencyKey,
        requestHash,
      });

      if (existingTransfer) {
        return existingTransfer;
      }

      throw new AppError(
        "A concurrent request may still be completing. Please retry using the same idempotency key.",
        503,
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }
}
