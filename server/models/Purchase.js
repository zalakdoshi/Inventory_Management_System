const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  gstPercentage: { type: Number, default: 18 },
  totalPrice: { type: Number, required: true },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseId: {
      type: String,
      unique: true,
      default: () => 'PO-' + Date.now().toString(36).toUpperCase(),
    },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    supplierName: { type: String },
    items: [purchaseItemSchema],
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'ordered', 'received', 'cancelled'],
      default: 'ordered',
    },
    purchaseDate: { type: Date, default: Date.now },
    notes: { type: String },
    purchasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receivedDate: { type: Date },
    invoiceNumber: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Purchase', purchaseSchema);
