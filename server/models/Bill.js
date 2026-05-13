const mongoose = require('mongoose');

const billItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  hsnCode: { type: String, default: '9999' },
  quantity: { type: Number, required: true },
  unit: { type: String, default: 'Piece' },
  unitPrice: { type: Number, required: true },
  gstPercentage: { type: Number, default: 18 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  taxableAmount: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
});

const billSchema = new mongoose.Schema(
  {
    billId: {
      type: String,
      unique: true,
      default: () => 'INV-' + Date.now().toString(36).toUpperCase(),
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
    customer: {
      name: { type: String, required: true },
      phone: { type: String },
      email: { type: String },
      address: { type: String },
      gstin: { type: String },
      state: { type: String },
    },
    company: {
      name: { type: String, default: 'Vardhman Family' },
      gstin: { type: String, default: '24AABCV1234A1Z5' },
      address: { type: String, default: 'Behind Piplav Dairy, At Piplav, Ta: Sojitra, Di: Anand, 388460' },
      phone: { type: String, default: '+91 9998160084' },
      email: { type: String, default: 'vardhmanfamily.corporate@gmail.com' },
      state: { type: String, default: 'Gujarat' },
      stateCode: { type: String, default: '24' },
    },
    items: [billItemSchema],
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    taxType: { type: String, enum: ['cgst_sgst', 'igst'], default: 'cgst_sgst' },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'cheque', 'credit'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    // E-invoice fields (IRN-ready)
    irn: { type: String, default: null },
    qrCode: { type: String, default: null },
    ackNumber: { type: String, default: null },
    ackDate: { type: Date, default: null },
    termsConditions: {
      type: String,
      default: 'Goods once sold will not be taken back. Subject to Anand jurisdiction.',
    },
    pdfPath: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    billDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bill', billSchema);
