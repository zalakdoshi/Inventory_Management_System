const Order = require('../models/Order');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Bill = require('../models/Bill');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const logger = require('../utils/logger');

const COMPANY = {
  name: 'Vardhman Family',
  gstin: '24AABCV1234A1Z5',
  address: 'Behind Piplav Dairy, At Piplav, Ta: Sojitra, Di: Anand, 388460',
};

/**
 * @desc    Dashboard analytics
 * @route   GET /api/reports/dashboard
 */
const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      totalProducts,
      lowStockProducts,
      totalUsers,
      totalOrders,
      monthOrders,
      totalRevenue,
      monthRevenue,
      totalPurchases,
      monthPurchases,
      recentActivities,
      ordersByStatus,
      revenueByMonth,
    ] = await Promise.all([
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ $expr: { $lte: ['$quantity', '$reorderLevel'] }, status: 'active' }),
      User.countDocuments({ isActive: true }),
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Bill.aggregate([{ $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Bill.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
      ]),
      Purchase.aggregate([{ $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      Purchase.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10).populate('user', 'name role'),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Bill.aggregate([
        { $match: { createdAt: { $gte: startOfYear } } },
        {
          $group: {
            _id: { month: { $month: '$createdAt' } },
            revenue: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.month': 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        lowStockProducts,
        totalUsers,
        totalOrders,
        monthOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        monthRevenue: monthRevenue[0]?.total || 0,
        totalPurchases: totalPurchases[0]?.total || 0,
        monthPurchases: monthPurchases[0]?.total || 0,
        recentActivities,
        ordersByStatus,
        revenueByMonth,
      },
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * @desc    Export reports as Excel
 * @route   GET /api/reports/export
 */
const exportReport = async (req, res) => {
  try {
    const { type = 'sales', format = 'excel' } = req.query;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Vardhman Family ERP';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(type.toUpperCase(), {
      headerFooter: { firstHeader: 'Vardhman Family ERP Report' },
    });

    // Style helper
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } },
      alignment: { horizontal: 'center' },
      border: { bottom: { style: 'thin' } },
    };

    if (type === 'sales') {
      const bills = await Bill.find().populate('createdBy', 'name').sort({ createdAt: -1 });
      sheet.columns = [
        { header: 'Invoice No', key: 'billId', width: 18 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Customer GSTIN', key: 'gstin', width: 20 },
        { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
        { header: 'Tax (₹)', key: 'tax', width: 12 },
        { header: 'Grand Total (₹)', key: 'grandTotal', width: 17 },
        { header: 'Payment Mode', key: 'paymentMode', width: 15 },
        { header: 'Created By', key: 'createdBy', width: 18 },
      ];
      sheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

      bills.forEach((b) => {
        sheet.addRow({
          billId: b.billId,
          date: new Date(b.billDate).toLocaleDateString('en-IN'),
          customer: b.customer.name,
          gstin: b.customer.gstin || '-',
          subtotal: b.subtotal,
          tax: b.taxTotal,
          grandTotal: b.grandTotal,
          paymentMode: b.paymentMode,
          createdBy: b.createdBy?.name || '-',
        });
      });
    } else if (type === 'purchases') {
      const purchases = await Purchase.find().populate('supplier', 'name').populate('purchasedBy', 'name').sort({ createdAt: -1 });
      sheet.columns = [
        { header: 'Purchase ID', key: 'purchaseId', width: 18 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Supplier', key: 'supplier', width: 25 },
        { header: 'Items Count', key: 'items', width: 12 },
        { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
        { header: 'Tax (₹)', key: 'tax', width: 12 },
        { header: 'Total (₹)', key: 'total', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Purchased By', key: 'purchasedBy', width: 18 },
      ];
      sheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

      purchases.forEach((p) => {
        sheet.addRow({
          purchaseId: p.purchaseId,
          date: new Date(p.purchaseDate).toLocaleDateString('en-IN'),
          supplier: p.supplierName || p.supplier?.name || '-',
          items: p.items.length,
          subtotal: p.subtotal,
          tax: p.taxAmount,
          total: p.totalAmount,
          status: p.status,
          purchasedBy: p.purchasedBy?.name || '-',
        });
      });
    } else if (type === 'inventory') {
      const products = await Product.find().populate('supplier', 'name').sort({ quantity: 1 });
      sheet.columns = [
        { header: 'Product ID', key: 'productId', width: 15 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Category', key: 'category', width: 20 },
        { header: 'HSN Code', key: 'hsn', width: 12 },
        { header: 'Quantity', key: 'quantity', width: 12 },
        { header: 'Unit', key: 'unit', width: 10 },
        { header: 'Reorder Level', key: 'reorder', width: 15 },
        { header: 'Purchase Price (₹)', key: 'purchasePrice', width: 18 },
        { header: 'Selling Price (₹)', key: 'sellingPrice', width: 18 },
        { header: 'Stock Value (₹)', key: 'stockValue', width: 17 },
        { header: 'GST %', key: 'gst', width: 10 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Supplier', key: 'supplier', width: 20 },
      ];
      sheet.getRow(1).eachCell((cell) => Object.assign(cell, headerStyle));

      products.forEach((p) => {
        const row = sheet.addRow({
          productId: p.productId,
          name: p.name,
          category: p.category,
          hsn: p.hsnCode,
          quantity: p.quantity,
          unit: p.unit,
          reorder: p.reorderLevel,
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          stockValue: p.quantity * p.sellingPrice,
          gst: `${p.gstPercentage}%`,
          status: p.status,
          supplier: p.supplier?.name || '-',
        });
        // Highlight low stock rows
        if (p.quantity <= p.reorderLevel) {
          row.getCell('quantity').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        }
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="vardhman_${type}_report_${Date.now()}.xlsx"`);
    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (error) {
    logger.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Export failed.' });
  }
};

/**
 * @desc    Get activity logs
 * @route   GET /api/reports/activity-logs
 */
const getActivityLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, module: mod = '', action = '' } = req.query;
    const query = {};
    if (mod) query.module = mod;
    if (action) query.action = action;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('user', 'name role'),
      ActivityLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getDashboardStats, exportReport, getActivityLogs };
