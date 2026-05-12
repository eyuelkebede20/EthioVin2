import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
export const authClient = createAuthClient({
  baseURL: `${BACKEND_URL}`,
  plugins: [adminClient()],
});
