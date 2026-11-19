import express from "express";
import request from "supertest";
import { describe, it, expect } from "vitest";

import { authorizeRole } from "../src/middleware/authorize.middleware.js";

const app = express();

app.get(
  "/admin",
  (req, res, next) => {
    const role = req.headers["x-test-role"];

    if (role) {
      req.user = { id: "test-user", role };
    }

    next();
  },
  authorizeRole("admin"),
  (_req, res) => {
    res.status(200).json({ message: "Admin access granted" });
  }
);

describe("Role-Based Access Control", () => {
  it("should reject unauthenticated requests with 401", async () => {
    const response = await request(app).get("/admin");

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authentication is required");
  });

  it("should reject ordinary users with 403", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "user");

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(
      "You do not have permission to access this resource"
    );
  });

  it("should allow administrators", async () => {
    const response = await request(app)
      .get("/admin")
      .set("x-test-role", "admin");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Admin access granted");
  });
});
