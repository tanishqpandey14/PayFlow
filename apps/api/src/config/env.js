import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../../../../.env", import.meta.url));
dotenv.config({ path: rootEnvPath });

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || Buffer.byteLength(jwtSecret, "utf8") < 32) {
  throw new Error("JWT_SECRET must be set and contain at least 32 bytes");
}

export const env = {
  apiPort: Number(process.env.PORT || process.env.API_PORT || 4000),
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:5173",
  mongoUri:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/payflow?replicaSet=rs0",
  jwtSecret,
};