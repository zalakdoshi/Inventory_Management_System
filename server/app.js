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

// ── Compression Middleware (Reduce response size) ────────────────
app.use(compression());

// ── Cache Headers Middleware ────────────────────────────────────
app.use((req, res, next) => {
  // Cache GET requests for 5 minutes
  if (req.method === 'GET') {
    res.set('Cache-Control', 'public, max-age=300');
  } else {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// ── Security Middleware ────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ────────────────────────────────────────────────────────
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

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || validOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

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
