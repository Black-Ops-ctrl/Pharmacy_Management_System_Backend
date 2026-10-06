const { Pool, types } = require('pg');

types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  application_name: 'pharmacy-api',
  options: `-c TimeZone=${process.env.DB_TIMEZONE || 'Asia/Karachi'}`,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

let announced = false;
pool.on('connect', () => {
  if (!announced) { console.log('✅ Database connected'); announced = true; }
});
pool.on('error', (err) => console.error('❌ Database error:', err.message));

module.exports = pool;
