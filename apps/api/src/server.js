import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

async function startServer() {
  try {
    await connectDatabase();

    app.listen(env.apiPort, "0.0.0.0", () => {
      console.log(`PayFlow API listening on port ${env.apiPort}`);
    });
  } catch (error) {
    console.error("Unable to start PayFlow API:", error.message);
    process.exit(1);
  }
}

startServer();