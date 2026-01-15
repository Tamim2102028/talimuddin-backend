import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: [
      process.env.CORS_ORIGIN,
      "http://localhost:5174", // pore remove kore dite hobe egula
      "http://localhost:5173", // pore remove kore dite hobe egula
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("public"));
app.use(cookieParser());

// ⏳ Global Latency Simulation Middleware
// app.use(async (req, res, next) => {
//   await new Promise((resolve) => setTimeout(resolve, 3000)); // 3 second delay
//   next();
// });

// Import and use routes
import authRouter from "./routes/auth.routes.js";
app.use("/api/v1/users", authRouter);

import { errorHandler } from "./middlewares/error.middleware.js";
import branchRouter from "./routes/branch.routes.js";
import profileRouter from "./routes/profile.routes.js";
import postRouter from "./routes/common/post.routes.js";
import commentRouter from "./routes/common/comment.routes.js";

app.use("/api/v1/posts", postRouter);
app.use("/api/v1/comments", commentRouter);

app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/branches", branchRouter);

// Global Error Handling Middleware
app.use(errorHandler);
export default app;
