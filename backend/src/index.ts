import express from "express";
import cors from "cors";
import vinRoutes from "./routes/vinRoutes";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import adminRoutes from "./routes/adminRoutes";

// Add this below your vinRoutes
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "ethiovin.senaycreatives.com"],
    credentials: true,
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
  console.log(`Server running on port ${PORT}`);
});
