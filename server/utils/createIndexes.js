/**
 * Create MongoDB indexes for better query performance
 */
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Purchase = require('../models/Purchase');
const Bill = require('../models/Bill');
const logger = require('./logger');

const createIndexes = async () => {
  try {
    logger.info('Creating database indexes...');

    // Product indexes
    await Product.collection.createIndex({ name: 1 });
    await Product.collection.createIndex({ productId: 1 });
    await Product.collection.createIndex({ barcode: 1 });
    await Product.collection.createIndex({ category: 1 });
    await Product.collection.createIndex({ status: 1 });
    await Product.collection.createIndex({ createdAt: -1 });

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ isActive: 1 });

    // Order indexes
    await Order.collection.createIndex({ orderNumber: 1 });
    await Order.collection.createIndex({ status: 1 });
    await Order.collection.createIndex({ createdAt: -1 });
    await Order.collection.createIndex({ createdBy: 1 });

    // Purchase indexes
    await Purchase.collection.createIndex({ purchaseNumber: 1 });
    await Purchase.collection.createIndex({ status: 1 });
    await Purchase.collection.createIndex({ createdAt: -1 });
    await Purchase.collection.createIndex({ supplier: 1 });

    // Bill indexes
    await Bill.collection.createIndex({ billNumber: 1 });
    await Bill.collection.createIndex({ status: 1 });
    await Bill.collection.createIndex({ createdAt: -1 });
    await Bill.collection.createIndex({ createdBy: 1 });

    logger.info('✅ Database indexes created successfully');
  } catch (error) {
    logger.error('Error creating indexes:', error.message);
  }
};

module.exports = createIndexes;
