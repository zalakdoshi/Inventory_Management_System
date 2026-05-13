require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Vardhman Family ERP Server running on port ${PORT}`);
    logger.info(`📌 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🌐 API Base: http://0.0.0.0:${PORT}/api`);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.message);
  process.exit(1);
});
