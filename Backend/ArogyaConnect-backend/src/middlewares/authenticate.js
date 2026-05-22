const jwt = require("jsonwebtoken");

const User = require("../models/User");

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("No token provided");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select(
      "role isActive isApproved"
    );

    if (!user || user.isActive === false) {
      const error = new Error("User not found or inactive");
      error.statusCode = 401;
      throw error;
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      isApproved: user.isApproved,
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      const expiredError = new Error("Token expired");
      expiredError.statusCode = 401;
      throw expiredError;
    }

    if (error.name === "JsonWebTokenError") {
      const invalidError = new Error("Invalid token");
      invalidError.statusCode = 401;
      throw invalidError;
    }

    throw error;
  }
};

module.exports = authenticate;
