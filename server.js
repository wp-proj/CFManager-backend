require('dotenv').config();
const app = require('./src/app');

const PORT = Number(process.env.PORT) || 4000;
app.get('/', (_req, res) => {
  res.json({
    name: 'Codeforces Backend',
    status: 'ok',
    docs: {
      health: '/health',
      compare: { method: 'POST', path: '/api/compare', body: { user1: 'handle', user2: 'handle' } }
    }
  });
});
app.listen(PORT, '127.0.0.1', () => {
  console.log(`✅ Server listening on http://127.0.0.1:${PORT}`);
});
