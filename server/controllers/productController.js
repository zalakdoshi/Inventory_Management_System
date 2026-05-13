const Product = require('../models/Product');
const { createActivityLog } = require('../middleware/activityLog');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

/**
 * @desc    Get all products with search, filter, pagination
 * @route   GET /api/products
 * @access  Private (all roles)
 */
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      status = '',
      lowStock = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { productId: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    if (status) query.status = status;
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$quantity', '$reorderLevel'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('supplier', 'name phone email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching products.' });
  }
};

/**
 * @desc    Get single product
 * @route   GET /api/products/:id
 * @access  Private
 */
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('supplier', 'name phone email gstin');
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Create product
 * @route   POST /api/products
 * @access  Admin only
 */
const createProduct = async (req, res) => {
  try {
    const productData = { ...req.body, createdBy: req.user._id };

    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
    }

    const product = await Product.create(productData);

    await createActivityLog({
      user: req.user,
      action: 'CREATE',
      module: 'Products',
      description: `Created product: ${product.name} (${product.productId})`,
      details: { productId: product._id, name: product.name },
      req,
      severity: 'medium',
    });

    res.status(201).json({ success: true, message: 'Product created successfully.', data: product });
  } catch (error) {
    logger.error('Create product error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Product ID or barcode already exists.' });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Admin only
 */
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const updateData = { ...req.body, updatedBy: req.user._id };

    if (req.file) {
      // Delete old image if exists
      if (product.image) {
        const oldPath = path.join(__dirname, '..', product.image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.image = `/uploads/products/${req.file.filename}`;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).populate('supplier', 'name');

    await createActivityLog({
      user: req.user,
      action: 'UPDATE',
      module: 'Products',
      description: `Updated product: ${product.name}`,
      details: { productId: product._id, changes: req.body },
      req,
      severity: 'medium',
    });

    res.status(200).json({ success: true, message: 'Product updated successfully.', data: updated });
  } catch (error) {
    logger.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

/**
 * @desc    Delete product
 * @route   DELETE /api/products/:id
 * @access  Admin only
 */
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    // Delete associated image
    if (product.image) {
      const imgPath = path.join(__dirname, '..', product.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }

    await Product.findByIdAndDelete(req.params.id);

    await createActivityLog({
      user: req.user,
      action: 'DELETE',
      module: 'Products',
      description: `Deleted product: ${product.name} (${product.productId})`,
      details: { productId: product._id, name: product.name },
      req,
      severity: 'high',
    });

    res.status(200).json({ success: true, message: 'Product deleted successfully.' });
  } catch (error) {
    logger.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Get inventory stats
 * @route   GET /api/products/stats
 * @access  Admin
 */
const getInventoryStats = async (req, res) => {
  try {
    const [total, lowStock, outOfStock, byCategory] = await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ $expr: { $lte: ['$quantity', '$reorderLevel'] }, status: 'active' }),
      Product.countDocuments({ quantity: 0, status: 'active' }),
      Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, totalValue: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: { total, lowStock, outOfStock, byCategory },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getInventoryStats };
