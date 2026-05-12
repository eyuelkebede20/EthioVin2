import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema.ts";
import "dotenv/config";

const FRONTEND_URL = process.env.FRONTEND_URL;

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
  baseURL: process.env.BACKEND_URL,
  trustedOrigins: [`${FRONTEND_URL}`],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
});
