import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import { User, Wallet } from "../src/models/index.js";
import { env } from "../src/config/env.js";

describe("Wallet API", () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({});
    await Wallet.deleteMany({});

    user = await User.create({
      name: "Wallet Tester",
      email: "wallet-test@payflow.dev",
      passwordHash: "test-password-hash",
    });

    token = jwt.sign(
      { sub: user._id.toString() },
      env.jwtSecret,
      {
        expiresIn: "1h",
        issuer: "payflow-api",
        audience: "payflow-web",
      }
    );
  });

  it("should reject requests without an authentication token", async () => {
    const response = await request(app)
      .get("/api/v1/wallet");

    expect(response.status).toBe(401);
  });

  it("should return the authenticated user's wallet", async () => {
    const wallet = await Wallet.create({
      user: user._id,
      currency: "INR",
      balance: 25000,
      status: "active",
    });

    const response = await request(app)
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.wallet).toMatchObject({
      id: wallet._id.toString(),
      currency: "INR",
      balance: 25000,
      status: "active",
    });
  });

  it("should return 404 when the user has no wallet", async () => {
    const response = await request(app)
      .get("/api/v1/wallet")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Wallet not found");
  });
});
