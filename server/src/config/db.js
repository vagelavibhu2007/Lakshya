require('dotenv').config();
const dns = require("node:dns/promises")
dns.setServers(["1.1.1.1"]);
const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  logger.info(`MongoDB connected: ${conn.connection.host}`);
};

module.exports = connectDB;