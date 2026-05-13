require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB().catch(err => {
  logger.error('Database connection failed:', err.message);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});

// Only listen if not in Vercel serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Vardhman Family ERP Server running on port ${PORT}`);
    logger.info(`📌 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🌐 API Base: http://0.0.0.0:${PORT}/api`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
});

// Export app for Vercel serverless functions
module.exports = app;
