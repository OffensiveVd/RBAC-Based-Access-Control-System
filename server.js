const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Ensures the DB file, five-table schema, and seed data exist before the
// server starts handling requests.
require('./src/models/db.init');

const authRoutes = require('./src/routes/auth.routes');
const userRoutes = require('./src/routes/user.routes');
const roleRoutes = require('./src/routes/role.routes');
const permissionRoutes = require('./src/routes/permission.routes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Basic brute-force protection on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Try again later.' },
});
app.use('/api/auth', authLimiter);

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found.' }));

// Centralized error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`RBAC server running on http://localhost:${PORT}`);
});

module.exports = app;
