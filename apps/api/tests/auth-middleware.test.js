import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import { User, Wallet } from "../src/models/index.js";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/utils/password.js";

describe("JWT Authentication Middleware", () => {
  let user;
  let token;

  beforeEach(async () => {
    await User.deleteMany({});
    await Wallet.deleteMany({});

    const passwordHash = await hashPassword("TestPassword123!");

    user = await User.create({
      name: "Middleware Tester",
      email: "middleware@payflow.dev",
      passwordHash,
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

  it("should reject requests without an authorization token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe(
      "Authentication token is required"
    );
  });

  it("should reject malformed tokens", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe(
      "Invalid or expired authentication token"
    );
  });

  it("should accept a valid token and return the user profile", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      id: user._id.toString(),
      name: "Middleware Tester",
      email: "middleware@payflow.dev",
      role: "user",
    });
  });

  it("should reject a valid token when its user no longer exists", async () => {
    await User.deleteOne({ _id: user._id });

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toBe(
      "User account no longer exists"
    );
  });
});
