"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

// Points at the Express API's better-auth handler (/api/auth/*). The browser
// sends the session cookie; the API's CORS allow-list + credentials make it work.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000",
  plugins: [adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
