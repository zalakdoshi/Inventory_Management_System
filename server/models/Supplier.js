const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    gstin: { type: String, trim: true, uppercase: true },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    categories: [{ type: String }],
    isActive: { type: Boolean, default: true },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Supplier', supplierSchema);
