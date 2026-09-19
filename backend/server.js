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

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mailer-saas')
  .then(async () => {
    console.log('MongoDB Connected Successfully');

    try {
      await EmailMessage.updateMany({ isFlagged: { $exists: false } }, {$set: { isFlagged: false } });
      await EmailMessage.updateMany({ isPinned: { $exists: false } }, {$set: { isPinned: false } });
      console.log('Legacy email documents migrated.');
    } catch (migErr) {
      console.error('Migration error:', migErr);
    }

    // 1. Mail Poller interval (runs every 30 seconds)
    pollIncomingEmails();
    setInterval(() => {
      pollIncomingEmails();
    }, 30000);

    // 2. BULLETPROOF BACKGROUND SCHEDULER & DISPATCHER (Runs every 30 seconds safely)
    // BULLETPROOF TIMEZONE-AGNOSTIC BACKGROUND SCHEDULER (Runs every 30 seconds)
    setInterval(async () => {
      try {
        const currentTimestamp = Date.now();
        
        if (mongoose.models.Campaign) {
          const CampaignModel = mongoose.model('Campaign');
          const ContactModel = mongoose.models.Contact;
          const SenderModel = mongoose.models.Sender;
          const LogModel = mongoose.models.CampaignLog;

          // Find campaigns where scheduledAt time (in milliseconds) is less than or equal to right now
          const dueCampaigns = await CampaignModel.find({ 
            status: 'Scheduled', 
            scheduledAt: { $lte: new Date(currentTimestamp) } 
          });

          if (dueCampaigns.length > 0) {
            console.log(`[Background Scheduler] Epoch match! Found ${dueCampaigns.length} due campaign(s). Dispatching...`);
            
            for (const camp of dueCampaigns) {
              camp.status = 'Processing';
              await camp.save();

              try {
                const senderRecord = await SenderModel.findOne({ email: camp.senderEmail });
                if (!senderRecord) {
                  camp.status = 'Cancelled';
                  await camp.save();
                  continue;
                }

                const contacts = await ContactModel.find({ 
                  group: { $regex: new RegExp(`^${camp.group}$`, 'i') },
                  status: 'Active' 
                });

                if (contacts.length === 0) {
                  camp.status = 'Cancelled';
                  await camp.save();
                  continue;
                }

                camp.status = 'Sent';
                camp.sentAt = new Date();
                await camp.save();

                for (const contact of contacts) {
                  const portNum = Number(senderRecord.port) || 465;
                  const transporter = (await import('nodemailer')).default.createTransport({
                    host: senderRecord.host || 'smtp.hostinger.com',
                    port: portNum,
                    secure: portNum === 465,
                    auth: { user: senderRecord.email, pass: senderRecord.password },
                    tls: { rejectUnauthorized: false }
                  });

                  const logRecord = await LogModel.create({
                    campaignTitle: camp.title || camp.subject || 'Scheduled Campaign',
                    senderEmail: senderRecord.email,
                    recipientEmail: contact.email,
                    status: 'Sent'
                  });

                  let personalizedHtml = (camp.htmlContent || '')
                    .replace(/{{name}}/g, contact.name || 'Valued Client')
                    .replace(/{{email}}/g, contact.email || '')
                    .replace(/{{company}}/g, contact.company || 'Your Company')
                    .replace(/{{mobile}}/g, contact.mobile || '')
                    .replace(/{{industry}}/g, contact.industry || '');

                  await transporter.sendMail({
                    from: `"IBC Studio" <${senderRecord.email}>`,
                    to: contact.email,
                    subject: camp.subject || 'Update from our Team',
                    html: personalizedHtml
                  });

                  await LogModel.findByIdAndUpdate(logRecord._id, { status: 'Delivered' });
                  transporter.close();
                  await new Promise(r => setTimeout(r, 300));
                }
                console.log(`[Background Scheduler] Successfully finished campaign: "${camp.title}"`);
              } catch (execErr) {
                console.error(`[Execution Error for Campaign ${camp._id}]:`, execErr.message);
                camp.status = 'Cancelled';
                await camp.save();
              }
            }
          }
        }
      } catch (schErr) {
        console.error('Background Scheduler Fatal Error:', schErr.message);
      }
    }, 30000);

    // Start server listener
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB Connection Error:', err));