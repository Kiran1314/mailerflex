import dotenv from 'dotenv';
dotenv.config(); // Must be at the very top before any service/route imports

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth.js';
import contactRoutes from './routes/contacts.js';
import campaignRoutes from './routes/campaigns.js';
import templateRoutes from './routes/templates.js';
import signatureRoutes from './routes/signatures.js'; 
import analyticsRoutes from './routes/analytics.js';
import webmailRoutes from './routes/webmail.js';
import senderRoutes from './routes/senders.js';
import EmailMessage from './models/EmailMessage.js'; 
import { pollIncomingEmails } from './services/mailPoller.js';

const app = express();

app.use(cors());
app.use(express.json());

// Serve static signatures folder
app.use('/signatures', express.static(path.join(process.cwd(), 'signatures')));

// Mount route handlers
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webmail', webmailRoutes); 

const PORT = process.env.PORT || 5001;

// Connect to MongoDB first, then boot up background tasks and server listener
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mailer-saas')
  .then(async () => {
    console.log('MongoDB Connected Successfully');

    // Run legacy migration safely after connection
    try {
      await EmailMessage.updateMany({ isFlagged: { $exists: false } }, { $set: { isFlagged: false } });
      await EmailMessage.updateMany({ isPinned: { $exists: false } }, { $set: { isPinned: false } });
      console.log('Legacy email documents migrated.');
    } catch (migErr) {
      console.error('Migration error:', migErr);
    }

    // Run mail poller immediately and set interval
    pollIncomingEmails();
    setInterval(() => {
      pollIncomingEmails();
    }, 30000);

    // Start server listener
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB Connection Error:', err));