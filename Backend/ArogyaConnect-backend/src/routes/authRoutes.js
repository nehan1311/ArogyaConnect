const express = require("express");

const {
  register,
  login,
  refreshToken,
  forgotPassword,
  resetPassword,
} = require("../controllers/authController");
const authenticate = require("../middlewares/authenticate");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/me", authenticate, async (req, res) => {
  const User = require("../models/User");
  const user = await User.findById(req.user.id).select("name email role isApproved profile").lean();
  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 401;
    throw err;
  }
  res.status(200).json({
    success: true,
    user: {
      id:         user._id.toString(),
      name:       user.name,
      email:      user.email,
      role:       user.role,
      isApproved: user.isApproved,
      profile:    user.profile,
    },
  });
});

module.exports = router;
