import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";

beforeAll(async () => {
  await mongoose.connect(
    "mongodb://127.0.0.1:27017/payflow_test?replicaSet=rs0"
  );
});

afterAll(async () => {
  await mongoose.disconnect();
});
