
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../src/app.js";
import {
  User,
  RiskFlag,
  AdminAuditLog,
} from "../src/models/index.js";
import { env } from "../src/config/env.js";

describe("Admin Risk Management API", () => {
  let admin;
  let regularUser;
  let adminToken;
  let userToken;
  let riskFlag;

  function createToken(user) {
    return jwt.sign(
      { sub: user._id.toString() },
      env.jwtSecret,
      {
        expiresIn: "1h",
        issuer: "payflow-api",
        audience: "payflow-web",
      }
    );
  }

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      RiskFlag.deleteMany({}),
      AdminAuditLog.deleteMany({}),
    ]);

    admin = await User.create({
      name: "Admin Tester",
      email: "admin@payflow.dev",
      passwordHash: "test-password-hash",
      role: "admin",
    });

    regularUser = await User.create({
      name: "Regular Tester",
      email: "regular@payflow.dev",
      passwordHash: "test-password-hash",
      role: "user",
    });

    adminToken = createToken(admin);
    userToken = createToken(regularUser);

    riskFlag = await RiskFlag.create({
      user: regularUser._id,
      reason: "Large transfer detected",
      severity: "high",
      status: "open",
    });
  });

  it("rejects requests without authentication", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags");

    expect(response.status).toBe(401);
  });

  it("rejects regular users", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(403);
  });

  it("allows admins to list risk flags", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.riskFlags).toHaveLength(1);
    expect(response.body.data.riskFlags[0].severity).toBe("high");
    expect(response.body.data.riskFlags[0].user.email)
      .toBe(regularUser.email);
  });

  it("filters risk flags by status and severity", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags?status=open&severity=high")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.riskFlags).toHaveLength(1);

    const invalidResponse = await request(app)
      .get("/api/v1/admin/risk-flags?status=invalid")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(invalidResponse.status).toBe(400);
  });

  it("supports pagination", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
  });

  it("rejects invalid pagination parameters", async () => {
    const response = await request(app)
      .get("/api/v1/admin/risk-flags?page=0&limit=500")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
  });

  it("retrieves one risk flag", async () => {
    const response = await request(app)
      .get(`/api/v1/admin/risk-flags/${riskFlag._id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.riskFlag.status).toBe("open");
  });

  it("returns 404 for a nonexistent risk flag", async () => {
    const missingId = "000000000000000000000001";

    const response = await request(app)
      .get(`/api/v1/admin/risk-flags/${missingId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
  });

  it("reviews a risk flag and creates an audit log", async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/risk-flags/${riskFlag._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Reviewed and verified" });

    expect(response.status).toBe(200);
    expect(response.body.data.riskFlag.status).toBe("reviewed");

    const auditLog = await AdminAuditLog.findOne({
      targetId: riskFlag._id,
    });

    expect(auditLog.action).toBe("RISK_FLAG_REVIEWED");
    expect(auditLog.reason).toBe("Reviewed and verified");
    expect(auditLog.admin.toString()).toBe(admin._id.toString());
  });

  it("dismisses a risk flag and creates an audit log", async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/risk-flags/${riskFlag._id}/dismiss`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "False positive after investigation" });

    expect(response.status).toBe(200);
    expect(response.body.data.riskFlag.status).toBe("dismissed");

    const auditLog = await AdminAuditLog.findOne({
      targetId: riskFlag._id,
    });

    expect(auditLog.action).toBe("RISK_FLAG_DISMISSED");
    expect(auditLog.reason)
      .toBe("False positive after investigation");
  });

  it("rejects review without a valid reason", async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/risk-flags/${riskFlag._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: " " });

    expect(response.status).toBe(400);
    expect(await AdminAuditLog.countDocuments()).toBe(0);

    const unchangedFlag = await RiskFlag.findById(riskFlag._id);
    expect(unchangedFlag.status).toBe("open");
  });

  it("prevents processing the same risk flag twice", async () => {
    await request(app)
      .patch(`/api/v1/admin/risk-flags/${riskFlag._id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "First review" });

    const secondResponse = await request(app)
      .patch(`/api/v1/admin/risk-flags/${riskFlag._id}/dismiss`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Second attempt" });

    expect(secondResponse.status).toBe(409);
    expect(await AdminAuditLog.countDocuments()).toBe(1);
  });
});
