const mongoose = require('mongoose');

// HSN codes for biogas/CNG/new categories
const HSN_CODES = {
  'Biogas Components': '8419',
  'CNG Equipment': '8412',
  'Pipes': '7304',
  'Valves': '8481',
  'Compressors': '8414',
  'Storage Equipment': '7311',
  'Fittings': '7307',
  'Safety Equipment': '3926',
  'Electrical': '8536',
  'Hydraulic': '8412',
  'Bearing': '8482',
  'Consumable': '3824',
  'Other': '9999',
};

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      unique: true,
      default: function () {
        return 'PRD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
      },
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Biogas Components',
        'CNG Equipment',
        'Pipes',
        'Valves',
        'Compressors',
        'Storage Equipment',
        'Fittings',
        'Safety Equipment',
        'Electrical',
        'Hydraulic',
        'Bearing',
        'Consumable',
        'Other',
      ],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Price cannot be negative'],
    },
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Price cannot be negative'],
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, 'Quantity cannot be negative'],
    },
    unit: {
      type: String,
      required: [true, 'Unit is required'],
      enum: ['Piece', 'Meter', 'KG', 'Liter', 'Set', 'Box', 'Roll', 'Pair'],
      default: 'Piece',
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    gstPercentage: {
      type: Number,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },
    hsnCode: {
      type: String,
      default: function () {
        return HSN_CODES[this.category] || '9999';
      },
    },
    barcode: { type: String, trim: true, default: null },
    description: { type: String, trim: true, default: '' },
    image: { type: String, default: null },
    reorderLevel: { type: Number, default: 10 },
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Virtual for low stock alert
productSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.reorderLevel;
});

// Text index for search
productSchema.index({ name: 'text', category: 'text', barcode: 'text', productId: 'text' });

module.exports = mongoose.model('Product', productSchema);
