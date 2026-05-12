import express from "express";
import cors from "cors";
import vinRoutes from "./routes/vinRoutes.ts";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.ts";
import adminRoutes from "./routes/adminRoutes.ts";
import "dotenv/config";
// Add this below your vinRoutes
const app = express();

const allowedOrigins = [`${process.env.FRONTEND_URL}`, "https://ethiovin.senaycreatives.com/", "http://localhost:3000", "http://localhost:5173"].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    // Explicitly allowing your custom auth headers
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
