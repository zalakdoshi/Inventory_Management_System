const Bill = require('../models/Bill');
const Order = require('../models/Order');
const { createActivityLog } = require('../middleware/activityLog');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const COMPANY = {
  name: 'Vardhman Family',
  tagline: 'All About Bio-Gas Machinery Manufacturer (In House)',
  gstin: '24AABCV1234A1Z5',
  address: 'Behind Piplav Dairy, At Piplav, Ta: Sojitra, Di: Anand, 388460',
  phone: '+91 9998160084',
  email: 'vardhmanfamily.corporate@gmail.com',
  state: 'Gujarat',
  stateCode: '24',
};

const rs = (n) => `Rs.${Number(n).toFixed(2)}`;
const rsInt = (n) => `Rs.${Number(n).toLocaleString('en-IN')}`;

const getBills = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = {};
    if (req.user.role === 'salesman') query.createdBy = req.user._id;
    if (search) query.$or = [{ billId: { $regex: search, $options: 'i' } }, { 'customer.name': { $regex: search, $options: 'i' } }];
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [bills, total] = await Promise.all([
      Bill.find(query).populate('createdBy', 'name role').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Bill.countDocuments(query),
    ]);
    res.status(200).json({ success: true, data: bills, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const createBill = async (req, res) => {
  try {
    const { customer, items, discount = 0, paymentMode = 'cash', taxType = 'cgst_sgst', orderId } = req.body;
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    const processedItems = [];
    for (const item of items) {
      const taxableAmount = item.unitPrice * item.quantity;
      const gstAmt = (taxableAmount * item.gstPercentage) / 100;
      let cgst = 0, sgst = 0, igst = 0;
      if (taxType === 'cgst_sgst') { cgst = gstAmt / 2; sgst = gstAmt / 2; } else { igst = gstAmt; }
      subtotal += taxableAmount; cgstTotal += cgst; sgstTotal += sgst; igstTotal += igst;
      processedItems.push({ ...item, taxableAmount, cgst, sgst, igst, totalAmount: taxableAmount + gstAmt });
    }
    const taxTotal = cgstTotal + sgstTotal + igstTotal;
    const grandTotalRaw = subtotal + taxTotal - discount;
    const roundOff = Math.round(grandTotalRaw) - grandTotalRaw;
    const grandTotal = Math.round(grandTotalRaw);
    const bill = await Bill.create({ customer, company: COMPANY, items: processedItems, subtotal, discount, cgstTotal, sgstTotal, igstTotal, taxTotal, roundOff, grandTotal, taxType, paymentMode, order: orderId || null, createdBy: req.user._id });
    if (orderId) await Order.findByIdAndUpdate(orderId, { bill: bill._id, paymentStatus: 'paid' });
    await createActivityLog({ user: req.user, action: 'CREATE', module: 'Bills', description: `Generated invoice ${bill.billId} for ${customer.name}`, details: { billId: bill._id }, req, severity: 'medium' });
    res.status(201).json({ success: true, message: 'Invoice created successfully.', data: bill });
  } catch (error) {
    logger.error('Create bill error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error.' });
  }
};

const generateBillPDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id).populate('createdBy', 'name');
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

    const logoPath = path.join(__dirname, '../../client/public/logo.png');
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${bill.billId}.pdf"`);
    doc.pipe(res);

    const dg = '#166534'; const g = '#16a34a';
    const M = 35; const PW = 595; const CW = PW - M * 2;

    // Header bar
    doc.rect(0, 0, PW, 92).fill(dg);
    if (fs.existsSync(logoPath)) { try { doc.image(logoPath, M, 8, { width: 74, height: 74 }); } catch(e) {} }
    const cx = M + 84;
    doc.fillColor('white').fontSize(17).font('Helvetica-Bold').text(COMPANY.name.toUpperCase(), cx, 10);
    doc.fontSize(8).font('Helvetica')
      .text(COMPANY.tagline, cx, 32)
      .text(COMPANY.address, cx, 43)
      .text(`Ph: ${COMPANY.phone}  |  ${COMPANY.email}`, cx, 54)
      .text(`GSTIN: ${COMPANY.gstin}  |  State: ${COMPANY.state} (${COMPANY.stateCode})`, cx, 65);

    // Title
    doc.fillColor(g).fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', 0, 100, { align: 'center', width: PW });
    doc.strokeColor(g).lineWidth(1.5).moveTo(M, 118).lineTo(PW - M, 118).stroke();

    // Bill info left
    let y = 126;
    const labelFont = () => doc.font('Helvetica-Bold').fillColor('#111').fontSize(8.5);
    const valFont = () => doc.font('Helvetica').fillColor('#333').fontSize(8.5);
    labelFont().text('Invoice No:', M, y); valFont().text(bill.billId, M + 78, y); y += 12;
    labelFont().text('Date:', M, y); valFont().text(new Date(bill.billDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), M + 78, y); y += 12;
    labelFont().text('Payment Mode:', M, y); valFont().text(bill.paymentMode.replace('_', ' ').toUpperCase(), M + 78, y);

    // Customer right
    const custX = PW / 2 + 15; let cy = 126;
    labelFont().text('Bill To:', custX, cy); cy += 12;
    doc.font('Helvetica-Bold').fillColor('#222').fontSize(9.5).text(bill.customer.name, custX, cy); cy += 13;
    doc.font('Helvetica').fillColor('#444').fontSize(8);
    if (bill.customer.address) { doc.text(bill.customer.address, custX, cy, { width: 225 }); cy += 11; }
    if (bill.customer.phone) { doc.text(`Phone: ${bill.customer.phone}`, custX, cy); cy += 11; }
    if (bill.customer.gstin) { doc.text(`GSTIN: ${bill.customer.gstin}`, custX, cy); cy += 11; }

    y = Math.max(y + 14, cy + 6);
    doc.strokeColor('#ddd').lineWidth(0.8).moveTo(M, y).lineTo(PW - M, y).stroke();
    y += 8;

    // Table columns — total = 525px
    const C = {
      no:    { x: M,       w: 18 },
      desc:  { x: M + 18,  w: 157 },
      hsn:   { x: M + 175, w: 40 },
      qty:   { x: M + 215, w: 52 },
      rate:  { x: M + 267, w: 60 },
      taxbl: { x: M + 327, w: 58 },
      gst:   { x: M + 385, w: 30 },
      tax:   { x: M + 415, w: 52 },
      total: { x: M + 467, w: 58 },
    };

    doc.rect(M, y, CW, 17).fill(dg);
    doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
    doc.text('#', C.no.x + 2, y + 4);
    doc.text('Description', C.desc.x, y + 4);
    doc.text('HSN', C.hsn.x, y + 4);
    doc.text('Qty', C.qty.x, y + 4);
    doc.text('Rate', C.rate.x, y + 4, { width: C.rate.w, align: 'right' });
    doc.text('Taxable', C.taxbl.x, y + 4, { width: C.taxbl.w, align: 'right' });
    doc.text('GST%', C.gst.x, y + 4);
    doc.text('Tax Amt', C.tax.x, y + 4, { width: C.tax.w, align: 'right' });
    doc.text('Total', C.total.x, y + 4, { width: C.total.w, align: 'right' });
    y += 17;

    bill.items.forEach((item, i) => {
      if (y > 680) { doc.addPage(); y = 40; }
      doc.rect(M, y, CW, 15).fill(i % 2 === 0 ? '#f0fdf4' : '#fff');
      doc.fillColor('#222').fontSize(7.5).font('Helvetica');
      doc.text(i + 1, C.no.x + 2, y + 3);
      doc.text(item.productName, C.desc.x, y + 3, { width: C.desc.w - 3 });
      doc.text(item.hsnCode || '9999', C.hsn.x, y + 3);
      doc.text(`${item.quantity} ${item.unit || 'Pc'}`, C.qty.x, y + 3);
      doc.text(rs(item.unitPrice), C.rate.x, y + 3, { width: C.rate.w, align: 'right' });
      doc.text(rs(item.taxableAmount), C.taxbl.x, y + 3, { width: C.taxbl.w, align: 'right' });
      doc.text(`${item.gstPercentage}%`, C.gst.x, y + 3);
      const taxAmt = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
      doc.text(rs(taxAmt), C.tax.x, y + 3, { width: C.tax.w, align: 'right' });
      doc.text(rs(item.totalAmount), C.total.x, y + 3, { width: C.total.w, align: 'right' });
      y += 15;
    });

    // Summary
    y += 8;
    doc.strokeColor('#ccc').lineWidth(0.8).moveTo(M, y).lineTo(PW - M, y).stroke();
    y += 10;
    const sL = PW / 2 + 40; const sV = PW - M - 5; const sW = 90;
    const sumRow = (label, val, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#111').fontSize(9).text(label, sL, y).text(val, sV - sW, y, { width: sW, align: 'right' });
      y += 14;
    };
    sumRow('Subtotal:', rs(bill.subtotal));
    if (bill.taxType === 'cgst_sgst') { sumRow('CGST:', rs(bill.cgstTotal)); sumRow('SGST:', rs(bill.sgstTotal)); }
    else sumRow('IGST:', rs(bill.igstTotal));
    if (bill.discount > 0) sumRow('Discount:', `-${rs(bill.discount)}`);
    if (bill.roundOff && Math.abs(bill.roundOff) > 0.001) sumRow('Round Off:', rs(bill.roundOff));

    y += 2;
    doc.rect(sL - 8, y, PW - M - sL + 8, 22).fill(dg);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
      .text('GRAND TOTAL:', sL - 3, y + 5)
      .text(rsInt(bill.grandTotal), sV - sW, y + 5, { width: sW, align: 'right' });
    y += 32;

    // QR + Terms
    doc.rect(M, y, 100, 80).lineWidth(1).strokeColor(g).stroke();
    doc.fillColor('#aaa').fontSize(8).font('Helvetica').text('QR Code\n(e-Invoice)', M, y + 28, { align: 'center', width: 100 });
    doc.fillColor('#444').fontSize(7.5).font('Helvetica-Bold').text('Terms & Conditions:', M + 115, y + 5);
    doc.font('Helvetica').fillColor('#555').text(bill.termsConditions || 'Goods once sold will not be taken back. Subject to Anand jurisdiction.', M + 115, y + 18, { width: CW - 120 });

    // Footer
    const fY = doc.page.height - 38;
    doc.strokeColor(dg).lineWidth(1).moveTo(M, fY - 6).lineTo(PW - M, fY - 6).stroke();
    doc.fillColor('#777').fontSize(7).font('Helvetica')
      .text('This is a computer-generated invoice. Queries: vardhmanfamily.corporate@gmail.com', M, fY, { align: 'center', width: CW })
      .text('Vardhman Family | Biogas & CNG Equipment Manufacturer | Anand, Gujarat', M, fY + 10, { align: 'center', width: CW });

    doc.end();
    await createActivityLog({ user: req.user, action: 'EXPORT', module: 'Bills', description: `Downloaded PDF for invoice ${bill.billId}`, req });
  } catch (error) {
    logger.error('PDF generation error:', error);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
};

module.exports = { getBills, createBill, generateBillPDF };
