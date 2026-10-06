const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const masters = require('./routes/masters');
const { sales, returns, orders } = require('./routes/sales');
const { po, grn, pr } = require('./routes/purchasing');

const app = express();

app.use(helmet());
app.use(cors({ exposedHeaders: ['X-Session-Expires', 'X-Status'] }));
app.use((req, res, next) => {
  if (req.get('x-soft-errors') === '1') {
    const status = res.status.bind(res);
    res.status = (code) => {
      if (code >= 400 && code < 500) {
        res.set('X-Status', String(code));
        return status(200);
      }
      return status(code);
    };
  }
  next();
});
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ success: true, service: 'pharmacy-api', status: 'ok', time: new Date().toISOString() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/company', require('./routes/company'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/lov', require('./routes/lov'));
app.use('/api/branches', masters.branches);
app.use('/api/cities', masters.cities);
app.use('/api/categories', masters.categories);
app.use('/api/uoms', masters.uoms);
app.use('/api/employees', masters.employees);
app.use('/api/suppliers', masters.suppliers);
app.use('/api/patients', masters.patients);
app.use('/api/finance', masters.finance);
app.use('/api/medicines', require('./routes/medicines'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', sales);
app.use('/api/sale-returns', returns);
app.use('/api/online-orders', orders);
app.use('/api/purchase-orders', po);
app.use('/api/grn', grn);
app.use('/api/purchase-returns', pr);
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/credit', require('./routes/credit'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/backups', require('./routes/backups'));

app.use((req, res) => res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use(errorHandler);

module.exports = app;
