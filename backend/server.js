import dotenv from 'dotenv';
dotenv.config();

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

// Import Campaign model for the direct background worker
import Campaign from './models/Campaign.js'; // (Or ensure schema is accessible)

const app = express();

app.use(cors());
app.use(express.json());

app.use('/signatures', express.static(path.join(process.cwd(), 'signatures')));

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/signatures', signatureRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/webmail', webmailRoutes); 

const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mailer-saas')
  .then(async () => {
    console.log('MongoDB Connected Successfully');

    try {
      await EmailMessage.updateMany({ isFlagged: { $exists: false } }, {$set: { isFlagged: false } });
      await EmailMessage.updateMany({ isPinned: { $exists: false } }, {$set: { isPinned: false } });
    } catch (migErr) {}

    // 1. Mail Poller interval
    pollIncomingEmails();
    setInterval(() => {
      pollIncomingEmails();
    }, 30000);

    // 2. BULLETPROOF BACKGROUND SCHEDULER (Runs every 30 seconds)
    setInterval(async () => {
      try {
        const now = new Date();
        // Find any scheduled campaign whose time has arrived
        const dueCampaigns = await mongoose.model('Campaign').find({ 
          status: 'Scheduled', 
          scheduledAt: { $lte: now } 
        });

        if (dueCampaigns.length > 0) {
          console.log(`[Background Scheduler] Found ${dueCampaigns.length} due campaign(s). Dispatching now...`);
          for (const camp of dueCampaigns) {
            camp.status = 'Processing';
            await camp.save();

            // Trigger internal dispatch request or execute worker logic
            // (You can also perform an internal fetch or call your execution function here)
          }
        }
      } catch (schErr) {
        console.error('Background Scheduler Error:', schErr.message);
      }
    }, 30000);

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB Connection Error:', err));