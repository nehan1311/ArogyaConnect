/**
 * seedAdmin.js — Creates the default ADMIN user in MongoDB.
 *
 * Run once:
 *   node src/scripts/seedAdmin.js
 *
 * Credentials (override via env):
 *   Email:    ADMIN_EMAIL    (default: admin@arogyaconnect.in)
 *   Password: ADMIN_PASSWORD (default: Admin@1234)
 *
 * The password must be ≥ 8 chars to satisfy the User model.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const User     = require("../models/User");

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || "admin@arogyaconnect.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@1234";
const ADMIN_NAME     = process.env.ADMIN_NAME     || "Platform Admin";

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const existing = await User.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log(`Admin already exists: ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    await User.create({
      name:       ADMIN_NAME,
      email:      ADMIN_EMAIL,
      password:   ADMIN_PASSWORD,
      role:       "ADMIN",
      isApproved: true,
      isActive:   true,
    });

    console.log(`Admin created successfully:`);
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log(`\nRun the server and log in at /admin-login`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  }
})();
