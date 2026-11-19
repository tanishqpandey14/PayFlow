
import { Router } from "express";

import { Wallet } from "../models/index.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

// Get the authenticated user's wallet.
router.get("/", authenticateToken, async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({
      user: req.user.id,
    });

    if (!wallet) {
      return res.status(404).json({
        error: "Wallet not found",
      });
    }

    return res.status(200).json({
      data: {
        wallet: {
          id: wallet._id,
          currency: wallet.currency,
          balance: wallet.balance,
          status: wallet.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;