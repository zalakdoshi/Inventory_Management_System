const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const { createActivityLog } = require('../middleware/activityLog');
const logger = require('../utils/logger');

/**
 * @desc    Get all purchases
 * @route   GET /api/purchases
 */
const getPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '', supplier = '' } = req.query;
    const query = {};

    // Purchaser sees only their own
    if (req.user.role === 'purchaser') {
      query.purchasedBy = req.user._id;
    }
    if (status) query.status = status;
    if (search) query.purchaseId = { $regex: search, $options: 'i' };
    if (supplier) {
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(supplier)) {
        query.supplier = supplier;
      } else {
        query.supplierName = { $regex: new RegExp(`^${supplier.trim()}$`, 'i') };
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('supplier', 'name phone')
        .populate('purchasedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Purchase.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: purchases,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('Get purchases error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Create purchase — updates inventory automatically
 * @route   POST /api/purchases
 */
const createPurchase = async (req, res) => {
  try {
    const { supplier, supplierName, items, notes, invoiceNumber, purchaseDate } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Purchase must have at least one item.' });
    }

    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${item.product} not found.` });
      }

      const itemTotal = item.unitPrice * item.quantity;
      const gstAmt = (itemTotal * (item.gstPercentage || product.gstPercentage)) / 100;
      subtotal += itemTotal;
      taxAmount += gstAmt;

      processedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstPercentage: item.gstPercentage || product.gstPercentage,
        totalPrice: itemTotal + gstAmt,
      });
    }

    const purchase = await Purchase.create({
      supplier: supplier || null,
      supplierName: supplierName || null,
      items: processedItems,
      subtotal,
      taxAmount,
      totalAmount: subtotal + taxAmount,
      purchasedBy: req.user._id,
      notes,
      invoiceNumber,
      purchaseDate: purchaseDate || new Date(),
      status: 'received',
    });

    // Auto-update inventory
    for (const item of processedItems) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { quantity: item.quantity },
      });
    }

    await createActivityLog({
      user: req.user,
      action: 'CREATE',
      module: 'Purchases',
      description: `Created purchase order ${purchase.purchaseId} — ₹${purchase.totalAmount.toFixed(2)}`,
      details: { purchaseId: purchase._id, items: processedItems.length, total: purchase.totalAmount },
      req,
      severity: 'medium',
    });

    res.status(201).json({ success: true, message: 'Purchase created and inventory updated.', data: purchase });
  } catch (error) {
    logger.error('Create purchase error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

/**
 * @desc    Update purchase
 * @route   PUT /api/purchases/:id
 */
const updatePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });

    // Only creator or admin can update
    if (req.user.role !== 'admin' && purchase.purchasedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this purchase.' });
    }

    const before = { status: purchase.status, totalAmount: purchase.totalAmount };
    const updated = await Purchase.findByIdAndUpdate(req.params.id, req.body, { new: true });

    await createActivityLog({
      user: req.user,
      action: 'UPDATE',
      module: 'Purchases',
      description: `Updated purchase ${purchase.purchaseId}`,
      details: { before, after: req.body },
      req,
      severity: 'medium',
    });

    res.status(200).json({ success: true, message: 'Purchase updated.', data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Delete purchase
 * @route   DELETE /api/purchases/:id
 */
const deletePurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });

    if (req.user.role !== 'admin' && purchase.purchasedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Reverse inventory if received
    if (purchase.status === 'received') {
      for (const item of purchase.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
      }
    }

    await Purchase.findByIdAndDelete(req.params.id);

    await createActivityLog({
      user: req.user,
      action: 'DELETE',
      module: 'Purchases',
      description: `Deleted purchase ${purchase.purchaseId}`,
      details: { purchaseId: purchase._id },
      req,
      severity: 'high',
    });

    res.status(200).json({ success: true, message: 'Purchase deleted and inventory adjusted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getPurchases, createPurchase, updatePurchase, deletePurchase };
