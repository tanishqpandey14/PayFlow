
import { Router } from "express";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { executeTransfer } from "../services/transfer.service.js";
import { Wallet, Transfer } from "../models/index.js";

const router = Router();

// Get the authenticated user's transaction history.
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50
    ) {
      return res.status(400).json({
        error: {
          message: "Page must be positive and limit must be between 1 and 50",
        },
      });
    }

    const wallet = await Wallet.findOne({ user: req.user.id }).select("_id");

    if (!wallet) {
      return res.status(404).json({
        error: { message: "Wallet not found" },
      });
    }

    const filter = {
      $or: [
        { sender: wallet._id },
        { receiver: wallet._id },
      ],
    };

    const [transfers, total] = await Promise.all([
      Transfer.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: "sender",
          select: "user",
          populate: {
            path: "user",
            select: "name email",
          },
        })
        .populate({
          path: "receiver",
          select: "user",
          populate: {
            path: "user",
            select: "name email",
          },
        })
        .lean(),

      Transfer.countDocuments(filter),
    ]);

    const transactions = transfers.map((transfer) => {
      const isOutgoing = String(transfer.sender?._id) === String(wallet._id);
      const otherWallet = isOutgoing ? transfer.receiver : transfer.sender;
      const counterparty = otherWallet?.user;

      return {
        id: String(transfer._id),
        reference: transfer.reference,
        direction: isOutgoing ? "sent" : "received",
        counterparty: counterparty
          ? {
              name: counterparty.name,
              email: counterparty.email,
            }
          : null,
        amount: transfer.amount,
        currency: transfer.currency,
        status: transfer.status,
        description: transfer.description,
        createdAt: transfer.createdAt,
      };
    });

    return res.status(200).json({
      message: "Transaction history retrieved successfully",
      data: {
        transactions,
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

// Create a wallet-to-wallet transfer.
router.post("/", authenticateToken, async (req, res, next) => {
  try {
    const { receiverEmail, amount, description = "" } = req.body;
    const idempotencyKey = req.get("Idempotency-Key");

    const transfer = await executeTransfer({
      senderUserId: req.user.id,
      receiverEmail,
      amount,
      idempotencyKey,
      description,
    });

    return res.status(201).json({
      message: "Transfer completed successfully",
      data: {
        transfer: {
          id: transfer._id,
          reference: transfer.reference,
          sender: transfer.sender,
          receiver: transfer.receiver,
          amount: transfer.amount,
          currency: transfer.currency,
          status: transfer.status,
          description: transfer.description,
          createdAt: transfer.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;