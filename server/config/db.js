const mongoose = require('mongoose');
const logger = require('../utils/logger');
const createIndexes = require('../utils/createIndexes');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority',
    });
    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Create indexes for better performance in the background (don't block connection/startup)
    createIndexes().catch(err => {
      logger.error(`❌ Failed to create indexes in background: ${err.message}`);
    });
  } catch (error) {
    logger.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
