const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/enhancedAuth');
const legacyAuthRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const taskRoutes = require('./routes/tasks');
const submissionRoutes = require('./routes/submissions');
const pointsRoutes = require('./routes/points');
const announcementRoutes = require('./routes/announcements');
const resourceRoutes = require('./routes/resources');
const eventRoutes = require('./routes/events');
const dashboardRoutes = require('./routes/dashboard');
const todoRoutes = require('./routes/todos');
const contactRoutes = require('./routes/contacts');
const attendanceRoutes = require('./routes/attendance');
const adminUsersRoutes = require('./routes/adminUsers');
const caRoutes = require('./routes/ca');
const referralRoutes = require('./routes/referrals');
const emailRoutes = require('./routes/emails');

const app = express();

// Trust proxy
app.set('trust proxy', 1);

// CORS
const allowedOrigins = [
  (process.env.CLIENT_ORIGIN || '').replace(/\/$/, ''),
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP logging
app.use(morgan('combined', {
  stream: { write: (message) => logger.http(message.trim()) },
}));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth-legacy', legacyAuthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/points', pointsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/ca', caRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (req, res) => res.status(200).send("OK"));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;