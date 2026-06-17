const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const purchaseRoutes = require('./routes/purchases');
const orderRoutes = require('./routes/orders');
const billRoutes = require('./routes/bills');
const userRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const passwordResetRoutes = require('./routes/passwordReset');

const app = express();

// ── CORS (must be FIRST, before all other middleware) ────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000',
  'https://vardhman-erp-beta.vercel.app',
  'https://vardhman-erp.vercel.app',
  process.env.FRONTEND_URL,
];

// Add Vercel deployment URL if available
if (process.env.VERCEL_URL) {
  allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
}

// Filter out undefined values
const validOrigins = allowedOrigins.filter(origin => origin && origin !== 'undefined');

// Helper to check if origin is allowed (includes *.vercel.app preview deploys)
function isOriginAllowed(origin) {
  if (!origin) return true;
  if (validOrigins.includes(origin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;
  if (process.env.NODE_ENV === 'development') return true;
  return false;
}

// Universal CORS middleware — handles preflight AND sets headers on all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.set('Access-Control-Allow-Origin', origin || '*');
    res.set('Access-Control-Allow-Credentials', 'true');
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  }
  // Handle preflight immediately — don't let any other middleware touch it
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ── Compression Middleware (Reduce response size) ────────────────
app.use(compression());

// ── Cache Headers Middleware ────────────────────────────────────
app.use((req, res, next) => {
  // Exclude API routes from GET caching to ensure fresh inventory and product data
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'public, max-age=300');
  } else {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// ── Security Middleware ────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── Rate Limiting ───────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// ── Body Parsing ────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Only log errors (4xx/5xx) in dev — skip noisy GET logs
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev', {
    skip: (req, res) => res.statusCode < 400,
    stream: { write: (msg) => logger.warn(msg.trim()) }
  }));
}

// ── Static Files ────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// ── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vardhman Family ERP API is running.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── Root Route ───────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Vardhman Family ERP API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      products: '/api/products',
      purchases: '/api/purchases',
      orders: '/api/orders',
      bills: '/api/bills',
      users: '/api/users',
      reports: '/api/reports',
      suppliers: '/api/suppliers',
    },
  });
});

// ── API Routes ──────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/password-reset', passwordResetRoutes);

// ── Public Contact Us / Get In Touch Inquiry Route ────────────────
const nodemailer = require('nodemailer');
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Vardhman Family Web" <${process.env.EMAIL_USER}>`,
      to: 'vardhmanfamily.corporate@gmail.com',
      replyTo: email,
      subject: `New Inquiry from Web: ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:30px;border-radius:12px;border:1px solid #e5e7eb;">
          <div style="background:#166534;padding:20px;border-radius:8px;text-align:center;margin-bottom:20px;">
            <h1 style="color:white;margin:0;font-size:22px;">New Website Inquiry</h1>
            <p style="color:#bbf7d0;margin:5px 0 0 0;font-size:14px;">Vardhman Family Biogas & CNG Solutions</p>
          </div>
          <div style="padding:10px 20px;background:white;border-radius:8px;border:1px solid #f3f4f6;">
            <p style="margin:10px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin:10px 0;"><strong>Email:</strong> <a href="mailto:${email}" style="color:#16a34a;">${email}</a></p>
            <p style="margin:10px 0;"><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <hr style="border:0;border-top:1px solid #f3f4f6;margin:15px 0;" />
            <p style="margin:10px 0;"><strong>Message/Query:</strong></p>
            <div style="background:#f0fdf4;padding:15px;border-radius:6px;border-left:4px solid #16a34a;white-space:pre-wrap;font-style:italic;color:#374151;">${message}</div>
          </div>
          <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:20px;">This inquiry was sent automatically from the Vardhman Family contact form.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    logger.error('Contact Us email failed to send:', error);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

// ── Suppliers Route ─────────────────────────────────────────────
const Supplier = require('./models/Supplier');
const { protect, authorize } = require('./middleware/auth');

app.get('/api/suppliers', protect, async (req, res) => {
  const suppliers = await Supplier.find({ isActive: true }).select('name phone email gstin categories');
  res.json({ success: true, data: suppliers });
});

app.post('/api/suppliers', protect, authorize('admin', 'purchaser'), async (req, res) => {
  try {
    const supplier = await Supplier.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: supplier, message: 'Supplier created.' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.put('/api/suppliers/:id', protect, authorize('admin'), async (req, res) => {
  const s = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: s });
});

app.delete('/api/suppliers/:id', protect, authorize('admin'), async (req, res) => {
  await Supplier.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Supplier deleted.' });
});

// ── 404 Handler ─────────────────────────────────────────────────
app.use('/{*path}', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Global error:', err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
