const Order = require('../models/Order');
const Product = require('../models/Product');
const Bill = require('../models/Bill');
const { createActivityLog } = require('../middleware/activityLog');
const logger = require('../utils/logger');

const STATUS_FLOW = ['created', 'pending', 'approved', 'packed', 'dispatched', 'delivered'];

/**
 * @desc    Get all orders
 * @route   GET /api/orders
 */
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = '', search = '' } = req.query;
    const query = {};

    if (req.user.role === 'salesman') query.createdBy = req.user._id;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('createdBy', 'name role')
        .populate('bill', 'billId grandTotal')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    logger.error('Get orders error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 */
const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('createdBy', 'name role email')
      .populate('bill');
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Create order
 * @route   POST /api/orders
 */
const createOrder = async (req, res) => {
  try {
    const { customer, items, discount = 0, paymentMode, taxType = 'cgst_sgst' } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must have at least one item.' });
    }

    let subtotal = 0;
    let taxAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.product} not found.` });
      if (product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
        });
      }

      const taxableAmt = item.unitPrice * item.quantity;
      const gstAmt = (taxableAmt * product.gstPercentage) / 100;
      let cgst = 0, sgst = 0, igst = 0;

      if (taxType === 'cgst_sgst') {
        cgst = gstAmt / 2;
        sgst = gstAmt / 2;
      } else {
        igst = gstAmt;
      }

      subtotal += taxableAmt;
      taxAmount += gstAmt;

      processedItems.push({
        product: product._id,
        productName: product.name,
        hsnCode: product.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice || product.sellingPrice,
        gstPercentage: product.gstPercentage,
        cgst,
        sgst,
        igst,
        totalPrice: taxableAmt + gstAmt,
      });
    }

    const totalAmount = subtotal + taxAmount - discount;

    const order = await Order.create({
      customer,
      items: processedItems,
      subtotal,
      discount,
      taxAmount,
      totalAmount,
      paymentMode,
      taxType,
      createdBy: req.user._id,
      timeline: [{ status: 'created', updatedBy: req.user._id, note: 'Order created by salesman' }],
    });

    await createActivityLog({
      user: req.user,
      action: 'CREATE',
      module: 'Orders',
      description: `Created order ${order.orderId} for ${customer.name} — ₹${totalAmount.toFixed(2)}`,
      details: { orderId: order._id },
      req,
      severity: 'medium',
    });

    res.status(201).json({ success: true, message: 'Order created successfully.', data: order });
  } catch (error) {
    logger.error('Create order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    const oldDeducted = ['approved', 'packed', 'dispatched', 'delivered'].includes(order.status);
    const newDeducted = ['approved', 'packed', 'dispatched', 'delivered'].includes(status);

    if (!oldDeducted && newDeducted) {
      // Check stock first
      for (const item of order.items) {
        const product = await Product.findById(item.product);
        if (!product || product.quantity < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for ${item.productName}. Available: ${product ? product.quantity : 0}`,
          });
        }
      }
      // Deduct stock
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } });
      }
    } else if (oldDeducted && !newDeducted) {
      // Restore stock (e.g., cancelled or downgraded back to created/pending)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } });
      }
    }

    order.status = status;
    order.timeline.push({ status, updatedBy: req.user._id, note: note || '' });
    if (status === 'delivered') order.paymentStatus = 'paid';
    await order.save();

    await createActivityLog({
      user: req.user,
      action: 'STATUS_CHANGE',
      module: 'Orders',
      description: `Order ${order.orderId} status changed to ${status}`,
      details: { orderId: order._id, status },
      req,
      severity: 'medium',
    });

    res.status(200).json({ success: true, message: `Order status updated to ${status}.`, data: order });
  } catch (error) {
    logger.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getOrders, getOrder, createOrder, updateOrderStatus };
