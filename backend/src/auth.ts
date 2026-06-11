import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db/index.ts";
import * as schema from "./db/schema.ts";
import "dotenv/config";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: (process.env.FRONTEND_URL ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  // Keep this — it's what surfaces req.user.role.
  user: {
    additionalFields: {
      role: { type: "string", input: false },
    },
  },
  // No adminRoles — your requireRole middleware handles authorization.
  plugins: [admin()],
});
