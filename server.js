require('dotenv').config();
const app = require('./src/app');
const { startScheduler } = require('./src/services/backup');

const PORT = process.env.PORT || 2195;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Pharmacy API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  startScheduler();
});
