const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/generateTokens");
const { sendPasswordResetEmail } = require("../services/emailService");

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const formatUserResponse = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  isApproved: user.isApproved,
});

const storeRefreshToken = async (user, refreshToken) => {
  user.refreshToken = await bcrypt.hash(refreshToken, 10);
  await user.save({ validateBeforeSave: false });
};

const register = async (req, res) => {
  const { name, email, password, role, profile } = req.body;

  if (!name || !email || !password || !role) {
    throw createError("Name, email, password, and role are required", 400);
  }

  if (!["PATIENT", "DOCTOR"].includes(role)) {
    throw createError("Only PATIENT or DOCTOR can self-register", 403);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });

  if (existingUser) {
    throw createError("Email already registered", 409);
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    profile,
    isApproved: role === "DOCTOR" ? false : true,
  });

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());

  await storeRefreshToken(user, refreshToken);

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  res.status(201).json({
    success: true,
    accessToken,
    user: formatUserResponse(user),
  });
};

const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw createError("Email and password are required", 400);
  }

  const user = await User.findOne({ email: (email || "").toLowerCase() }).select(
    "+password +failedLoginAttempts +lockUntil +refreshToken +isActive"
  );

  if (!user) {
    throw createError("Invalid credentials", 401);
  }

  if (user.isActive === false) {
    throw createError("Account deactivated. Contact support.", 403);
  }

  if (user.isLocked()) {
    throw createError("Account locked. Try again after 15 minutes.", 423);
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    await user.incrementFailedAttempts();
    throw createError("Invalid credentials", 401);
  }

  await user.resetFailedAttempts();

  const accessToken = generateAccessToken(user._id.toString(), user.role);
  const refreshToken = generateRefreshToken(user._id.toString());

  await storeRefreshToken(user, refreshToken);

  res.cookie("refreshToken", refreshToken, refreshCookieOptions);
  res.status(200).json({
    success: true,
    accessToken,
    user: formatUserResponse(user),
  });
};

const refreshToken = async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;

  if (!incomingRefreshToken) {
    throw createError("No refresh token", 401);
  }

  let decoded;

  try {
    decoded = jwt.verify(
      incomingRefreshToken,
      process.env.JWT_REFRESH_SECRET
    );
  } catch (error) {
    throw createError("Invalid refresh token", 401);
  }

  const user = await User.findById(decoded.id).select("+refreshToken");

  if (!user) {
    throw createError("Invalid refresh token", 401);
  }

  const isTokenMatch =
    user.refreshToken &&
    (await bcrypt.compare(incomingRefreshToken, user.refreshToken));

  if (!isTokenMatch) {
    throw createError("Token mismatch", 401);
  }

  const newAccessToken = generateAccessToken(user._id.toString(), user.role);
  const newRefreshToken = generateRefreshToken(user._id.toString());

  await storeRefreshToken(user, newRefreshToken);

  res.cookie("refreshToken", newRefreshToken, refreshCookieOptions);
  res.status(200).json({
    success: true,
    accessToken: newAccessToken,
  });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const message = "If that email exists, a reset link has been sent.";

  const user = await User.findOne({ email: (email || "").toLowerCase() }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    const frontendURL = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetURL = `${frontendURL}/reset-password/${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetURL);
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw createError("Failed to send password reset email", 500);
    }
  }

  res.status(200).json({
    success: true,
    message,
  });
};

const resetPassword = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    throw createError("Password is required", 400);
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) {
    throw createError("Invalid or expired reset token", 400);
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Password reset successful. Please log in.",
  });
};

module.exports = {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
};
