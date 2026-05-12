import express from "express";
import cors from "cors";
import vinRoutes from "./routes/vinRoutes.ts";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.ts";
import adminRoutes from "./routes/adminRoutes.ts";
import "dotenv/config";
// Add this below your vinRoutes
const app = express();

app.use(
  cors({
    origin: ["https://ethiovin.senaycreatives.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
  }),
);
// Intercept auth routes before Express router parses or strips the URL
app.use((req, res, next) => {
  if (req.url.startsWith("/api/auth")) {
    return toNodeHandler(auth)(req, res);
  }
  next();
});

app.use(express.json());
app.use("/api/v1/vin", vinRoutes);
app.use("/api/v1/admin", adminRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} ${process.env.FRONTEND_URL}`);
});
