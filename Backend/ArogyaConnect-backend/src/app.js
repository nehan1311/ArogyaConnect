require("express-async-errors");

const express      = require("express");
const helmet       = require("helmet");
const cors         = require("cors");
const morgan       = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes   = require("./routes/authRoutes");
const adminRoutes  = require("./routes/adminRoutes");
const healthRoutes = require("./routes/healthRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

// ── Security ─────────────────────────────────────────────────────
app.use(helmet());

// Allow the Vite dev server (port 5173) and any configured FRONTEND_URL
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      // Also allow any localhost origin in development
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV === "development" && /^http:\/\/localhost:\d+$/.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

// ── Body / logging ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/health", healthRoutes);
app.use("/api/auth",   authRoutes);
app.use("/api/admin",  adminRoutes);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
