const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/live", async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is live",
    timestamp: new Date().toISOString(),
  });
});

router.get("/db", async (req, res) => {
  const state = mongoose.connection.readyState;

  if (state !== 1) {
    return res.status(503).json({
      success: false,
      message: "DB not connected",
    });
  }

  return res.status(200).json({
    success: true,
    message: "DB connected",
    state,
  });
});

module.exports = router;
