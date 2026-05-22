const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    const error = new Error("Access denied");
    error.statusCode = 403;
    throw error;
  }

  next();
};

module.exports = authorize;
