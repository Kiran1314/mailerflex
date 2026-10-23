import cron from 'node-cron';
import nodemailer from 'nodemailer';
import Campaign from '../models/Campaign.js';
import Sender from '../models/Sender.js';
import EmailMessage from '../models/EmailMessage.js';

const HOURLY_LIMIT = 200;

export const startCampaignQueue = () => {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const activeCampaigns = await Campaign.find({
        status: 'running',
        nextRunAt: { $lte: now }
      });

      for (const campaign of activeCampaigns) {
        const batch = campaign.pendingContacts.slice(0, HOURLY_LIMIT);
        const remaining = campaign.pendingContacts.slice(HOURLY_LIMIT);

        const senderAcc = await Sender.findOne({ email: campaign.senderEmailId });
        if (!senderAcc) continue;

        const transporter = nodemailer.createTransport({
          host: senderAcc.smtpHost || 'smtp.hostinger.com',
          port: 465,
          secure: true,
          auth: { user: senderAcc.email, pass: senderAcc.password }
        });

        for (const recipient of batch) {
          try {
            await transporter.sendMail({
              from: senderAcc.email,
              to: recipient,
              subject: campaign.subject,
              html: campaign.htmlContent
            });

            await EmailMessage.create({
              senderEmailId: senderAcc.email,
              to: recipient,
              subject: campaign.subject,
              folder: 'sent',
              date: new Date()
            });
          } catch (sendErr) {
            console.error(`Failed to send to ${recipient}:`, sendErr.message);
          }
        }

        campaign.sentContacts.push(...batch);
        campaign.pendingContacts = remaining;

        if (remaining.length === 0) {
          campaign.status = 'completed';
        } else {
          campaign.nextRunAt = new Date(now.getTime() + 60 * 60 * 1000); 
        }

        await campaign.save();
      }
    } catch (error) {
      console.error('Queue Processing Error:', error.message);
    }
  });
};