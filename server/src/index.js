import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { beneficiariesRouter } from './routes/beneficiaries.js';
import { dashboardRouter } from './routes/dashboard.js';
import { lookupsRouter } from './routes/lookups.js';
import { referralsRouter } from './routes/referrals.js';
import { reportsRouter } from './routes/reports.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://localhost:5173',
      'http://localhost:5174',
      process.env.CLIENT_ORIGIN
    ].filter(Boolean);
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ReferralLink API' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/lookups', lookupsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/beneficiaries', beneficiariesRouter);
app.use('/api/referrals', referralsRouter);
app.use('/api/reports', reportsRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json({
    message: error.message || 'Unexpected server error.'
  });
});

app.listen(port, () => {
  console.log(`ReferralLink API listening on http://127.0.0.1:${port}`);
});
