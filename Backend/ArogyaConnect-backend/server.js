require("dotenv").config();

const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

process.on("unhandledRejection", (error) => {
  console.error(error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error(error);
  process.exit(1);
});

(async () => {
  await connectDB();
  require("./src/services/schedulerService");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  });
})();
