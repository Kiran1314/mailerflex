import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.js';

// Import your routes
import contactRoutes from './routes/contacts.js';
import campaignRoutes from './routes/campaigns.js';
import templateRoutes from './routes/templates.js';
import signatureRoutes from './routes/signatures.js'; 
import analyticsRoutes from './routes/analytics.js';
import webmailRoutes from './routes/webmail.js';
import senderRoutes from './routes/senders.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
// Serve static signatures folder
app.use('/signatures', express.static(path.join(process.cwd(), 'signatures')));

// CRITICAL: Mount your route handlers here
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webmail', webmailRoutes);

const PORT = process.env.PORT || 5001;
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mailer-saas')
  .then(() => {
    console.log('MongoDB Connected Locally');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB Connection Error:', err));