import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";

import app from "../src/app.js";
import { User, Wallet } from "../src/models/index.js";

describe("Authentication API", () => {
  beforeEach(async () => {
    // Keep each test independent.
    await User.deleteMany({});
    await Wallet.deleteMany({});
  });

  describe("POST /api/v1/auth/register", () => {
    it("should register a user and create their wallet", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Test User",
          email: "Test.User@PayFlow.dev",
          password: "TestPassword123!",
        });

      expect(response.status).toBe(201);
      expect(response.body.data.user).toMatchObject({
        name: "Test User",
        email: "test.user@payflow.dev",
        role: "user",
      });

      // The API must not expose the password hash.
      expect(response.body.data.user.passwordHash).toBeUndefined();

      const savedUser = await User.findOne({
        email: "test.user@payflow.dev",
      });

      expect(savedUser).not.toBeNull();
      expect(savedUser.passwordHash).not.toBe("TestPassword123!");

      const savedWallet = await Wallet.findOne({
        user: savedUser._id,
      });

      expect(savedWallet).not.toBeNull();
      expect(savedWallet.currency).toBe("INR");
      expect(savedWallet.balance).toBe(0);
    });

    it("should reject duplicate email registrations", async () => {
      const registration = {
        name: "Test User",
        email: "duplicate@payflow.dev",
        password: "TestPassword123!",
      };

      const firstResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(registration);

      const secondResponse = await request(app)
        .post("/api/v1/auth/register")
        .send(registration);

      expect(firstResponse.status).toBe(201);
      expect(secondResponse.status).toBe(409);

      expect(
        await User.countDocuments({ email: "duplicate@payflow.dev" })
      ).toBe(1);

      expect(
        await Wallet.countDocuments({})
      ).toBe(1);
    });

    it("should reject invalid registration input", async () => {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "A",
          email: "invalid-email",
          password: "short",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    beforeEach(async () => {
      await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Login Tester",
          email: "login@payflow.dev",
          password: "TestPassword123!",
        });
    });

    it("should log in with correct credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "LOGIN@PAYFLOW.DEV",
          password: "TestPassword123!",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.token).toBeTruthy();
      expect(response.body.data.user.email).toBe("login@payflow.dev");
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it("should reject an incorrect password", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "login@payflow.dev",
          password: "WrongPassword123!",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });

    it("should reject an unknown email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "unknown@payflow.dev",
          password: "TestPassword123!",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid email or password");
    });
  });
});
