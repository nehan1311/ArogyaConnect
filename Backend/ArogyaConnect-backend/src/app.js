require("express-async-errors");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const appointmentRoutes = require("./routes/appointmentRoutes");
const authRoutes = require("./routes/authRoutes");
const doctorRoutes = require("./routes/doctorRoutes");
const healthRoutes = require("./routes/healthRoutes");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cookieParser());

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/doctors", doctorRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

module.exports = app;
