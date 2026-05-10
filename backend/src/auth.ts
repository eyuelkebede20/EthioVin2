import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";

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
  baseURL: "http://localhost:3000",
  trustedOrigins: ["http://localhost:5173", "ethiovinapi.senaycreatives.com"],
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
});
