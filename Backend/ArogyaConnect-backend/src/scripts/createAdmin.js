require("dotenv").config();

const mongoose = require("mongoose");

const User = require("../models/User");

async function createAdmin() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ role: "ADMIN" });
  if (existing) {
    console.log("Admin already exists:", existing.email);
    process.exit(0);
  }

  const admin = await User.create({
    name: "Super Admin",
    email: process.env.ADMIN_EMAIL || "admin@telehealth.com",
    password: "Admin@1234",
    role: "ADMIN",
    isApproved: true,
    isActive: true,
  });

  console.log("─────────────────────────────────");
  console.log("Admin account created successfully");
  console.log("Email:   ", admin.email);
  console.log("Password: Admin@1234");
  console.log("IMPORTANT: Change this password immediately after first login");
  console.log("─────────────────────────────────");
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error("Failed to create admin:", err.message);
  process.exit(1);
});
