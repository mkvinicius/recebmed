import { randomBytes } from "crypto";

if (!process.env.JWT_SECRET) {
  console.warn("[SECURITY] JWT_SECRET not set — generating ephemeral key. Sessions will NOT survive restarts.");
}

export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(64).toString("hex");
