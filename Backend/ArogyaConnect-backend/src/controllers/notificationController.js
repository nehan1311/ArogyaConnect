const Notification = require("../models/Notification");

const getMyNotifications = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 20, 1);
  const skip = (page - 1) * limit;
  const query = { recipient: req.user.id };

  if (req.query.type) {
    query.type = req.query.type;
  }

  if (req.query.status) {
    query.status = req.query.status;
  }

  const [notifications, total] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    count: notifications.length,
    total,
    page,
    notifications,
  });
};

const getNotificationStats = async (req, res) => {
  const stats = await Notification.aggregate([
    {
      $group: {
        _id: {
          type: "$type",
          status: "$status",
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        type: "$_id.type",
        status: "$_id.status",
        count: 1,
      },
    },
    {
      $sort: {
        type: 1,
        status: 1,
      },
    },
  ]);

  res.status(200).json({
    success: true,
    stats,
  });
};

module.exports = {
  getMyNotifications,
  getNotificationStats,
};
