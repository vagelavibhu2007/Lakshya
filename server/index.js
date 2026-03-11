require('dotenv').config();
const dns = require("node:dns/promises")
dns.setServers(["1.1.1.1"]);

const app = require('./src/app');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const { startWeeklyLeaderboardCron } = require('./src/cron/weeklyLeaderboard');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });

  // Start cron jobs
  startWeeklyLeaderboardCron();
}).catch((err) => {
  logger.error('Failed to connect to MongoDB', err);
  process.exit(1);
});