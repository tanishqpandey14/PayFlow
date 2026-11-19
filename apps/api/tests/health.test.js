
import { describe, it, expect } from "vitest";
import request from "supertest";

import app from "../src/app.js";

describe("Health API", () => {
  it("should return API health information", async () => {
    const response = await request(app)
      .get("/api/v1/health");

    expect(response.status).toBe(200);

    expect(response.body.data).toMatchObject({
      status: "ok",
      service: "payflow-api",
      mode: "simulation",
      database: "connected",
    });
  });
});