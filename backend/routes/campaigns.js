import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import cron from 'node-cron';

const router = express.Router();

const CampaignSchema = new mongoose.Schema({
  title: String,
  subject: String,
  group: String,
  senderEmail: String,
  htmlContent: String,
  cc: String,
  bcc: String,
  status: { type: String, enum: ['Scheduled', 'Processing', 'Sent', 'Cancelled'], default: 'Scheduled' },
  scheduledAt: { type: Date, default: null }, 
  
  // NEW: Queue tracking fields for hourly limits
  pendingContacts: { type: [String], default: [] },
  sentContacts: { type: [String], default: [] },
  nextRunAt: { type: Date, default: null },

  sentAt: { type: Date, default: Date.now }
});

const CampaignLogSchema = new mongoose.Schema({
  campaignTitle: String,
  senderEmail: String,
  recipientEmail: String,
  status: { type: String, enum: ['Sent', 'Delivered', 'Bounced', 'Failed'], default: 'Sent' },
  opened: { type: Boolean, default: false },
  clicked: { type: Boolean, default: false },
  unsubscribed: { type: Boolean, default: false },
  errorDetails: String,
  sentAt: { type: Date, default: Date.now }
});

const ContactSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true },
  company: String,
  mobile: String,
  industry: String,
  group: String,
  status: { type: String, enum: ['Active', 'Invalid', 'Unverified'], default: 'Active' }
});

const SenderSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  host: { type: String, required: true },
  port: { type: Number, required: true },
  password: { type: String, required: true }
});

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
const CampaignLog = mongoose.models.CampaignLog || mongoose.model('CampaignLog', CampaignLogSchema);
const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
const Sender = mongoose.models.Sender || mongoose.model('Sender', SenderSchema);

const HOURLY_LIMIT = 200; // Hostinger max threshold

// Background Batch Dispatch Worker
export async function processCampaignBatch(camp) {
  try {
    console.log(`[Batch Worker] Processing batch for campaign: "${camp.title}"`);
    
    const senderRecord = await Sender.findOne({ email: camp.senderEmail });
    if (!senderRecord) {
      console.error(`[Cron Worker Error] Sender configuration for ${camp.senderEmail} not found.`);
      camp.status = 'Cancelled';
      await camp.save();
      return;
    }

    // Slice 200 contacts for this hour's slot
    const batchEmails = camp.pendingContacts.slice(0, HOURLY_LIMIT);
    const remainingEmails = camp.pendingContacts.slice(HOURLY_LIMIT);

    if (batchEmails.length === 0) {
      camp.status = 'Sent';
      await camp.save();
      return;
    }

    // Fetch full contact details for personalization
    const contacts = await Contact.find({ email: { $in: batchEmails } });

    const portNum = Number(senderRecord.port) || 465;
    const isSecure = portNum === 465;

    let processedHtml = camp.htmlContent || '';
    let attachments = [];
    
    // Process local embedded signature images
    if (typeof processedHtml === 'string') {
      const imgRegex = /src="(?:https?:\/\/[^/]+)?(\/signatures\/[^"]+)"/g;
      let match;
      while ((match = imgRegex.exec(processedHtml)) !== null) {
        const fullMatchTag = match[0];
        const relativePath = match[1];
        const localFilePath = path.join(process.cwd(), relativePath);

        if (fs.existsSync(localFilePath)) {
          const uniqueCid = `sig-${Date.now()}-${Math.floor(Math.random() * 1000)}@mailer.local`;
          processedHtml = processedHtml.replace(fullMatchTag, `src="cid:${uniqueCid}"`);
          attachments.push({ filename: path.basename(localFilePath), path: localFilePath, cid: uniqueCid });
        }
      }
    }

    // Initialize Transporter
    const transporter = nodemailer.createTransport({
      host: senderRecord.host || 'smtp.hostinger.com',
      port: portNum,
      secure: isSecure,
      auth: { user: senderRecord.email, pass: senderRecord.password },
      tls: { rejectUnauthorized: false },
      pool: true,
      maxConnections: 1,
      maxMessages: HOURLY_LIMIT
    });

    for (const contact of contacts) {
      try {
        const logRecord = await CampaignLog.create({
          campaignTitle: camp.title || camp.subject || 'Untitled Campaign',
          senderEmail: senderRecord.email,
          recipientEmail: contact.email,
          status: 'Sent',
          opened: false,
          clicked: false,
          unsubscribed: false
        });

        let personalizedHtml = processedHtml
          .replace(/{{name}}/g, contact.name || 'Valued Client')
          .replace(/{{email}}/g, contact.email || '')
          .replace(/{{company}}/g, contact.company || 'Your Company')
          .replace(/{{mobile}}/g, contact.mobile || '')
          .replace(/{{industry}}/g, contact.industry || '');

        // NEW FIX: Ensure we ONLY target href inside anchor (<a>) tags, ignoring <img> tags
        personalizedHtml = personalizedHtml.replace(/<a([^>]+)href="([^"]+)"([^>]*)>/gi, (match, before, origUrl, after) => {
          if (origUrl.includes('https://mailer.ibcstudio.com/api/analytics')) return match;
          if (origUrl.startsWith('mailto:') || origUrl.startsWith('tel:')) return match;
          const clickTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/click?id=${logRecord._id}&url=${encodeURIComponent(origUrl)}`;
          return `<a${before}href="${clickTrackerUrl}"${after}>`;
        });

        const openTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/open/${logRecord._id}`;
        const unsubscribeUrl = `https://mailer.ibcstudio.com/api/analytics/unsubscribe/${logRecord._id}`;

        personalizedHtml += `<img src="${openTrackerUrl}" width="1" height="1" style="display:none;" alt="" />`;
        personalizedHtml += `<br><p style="font-size: 11px; color: #888; text-align: center; margin-top: 20px;">Don't want these emails anymore? <a href="${unsubscribeUrl}" style="color: #555; text-decoration: underline;">Unsubscribe here</a>.</p>`;

        let mailOptions = {
          from: `"IBC Studio" <${senderRecord.email}>`,
          to: contact.email,
          subject: camp.subject || 'Update from our Team',
          html: personalizedHtml,
          attachments: attachments.length > 0 ? attachments : undefined
        };

        if (camp.cc && camp.cc.trim() !== '') mailOptions.cc = camp.cc.trim();
        if (camp.bcc && camp.bcc.trim() !== '') mailOptions.bcc = camp.bcc.trim();

        await transporter.sendMail(mailOptions);
        await CampaignLog.findByIdAndUpdate(logRecord._id, { status: 'Delivered' });
      } catch (mailErr) {
        console.error(`[SMTP Error] Failed for ${contact.email}:`, mailErr.message);
      }
      
      // Prevent overwhelming the SMTP port
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    transporter.close();

    // Update Campaign Queue Data
    camp.sentContacts.push(...batchEmails);
    camp.pendingContacts = remainingEmails;
    
    if (remainingEmails.length === 0) {
      camp.status = 'Sent';
      console.log(`[Batch Worker] Campaign "${camp.title}" has fully completed.`);
    } else {
      // Schedule the next 200 slot for exactly 1 hour from now
      camp.nextRunAt = new Date(Date.now() + 60 * 60 * 1000); 
      console.log(`[Batch Worker] Placed remaining ${remainingEmails.length} emails into queue. Next batch runs at ${camp.nextRunAt}`);
    }
    
    await camp.save();

  } catch (err) {
    console.error('[Batch Execution Fatal Error]:', err.message);
  }
}

// BACKGROUND CRON JOB: Runs every 2 minutes to check for due limits
cron.schedule('*/2 * * * *', async () => {
  try {
    const now = new Date();
    
    // 1. Move freshly due 'Scheduled' campaigns into 'Processing'
    const dueScheduled = await Campaign.find({ status: 'Scheduled', scheduledAt: { $lte: now } });
    for (const camp of dueScheduled) {
      // Grab all active contacts for this group
      const activeContacts = await Contact.find({ group: { $regex: new RegExp(`^${camp.group}$`, 'i') }, status: 'Active' });
      camp.pendingContacts = activeContacts.map(c => c.email);
      camp.status = 'Processing';
      camp.nextRunAt = now; // Ready to run immediately
      await camp.save();
    }

    // 2. Process active queued batches where the 1-hour wait is over
    const activeCampaigns = await Campaign.find({ status: 'Processing', nextRunAt: { $lte: now } });
    for (const camp of activeCampaigns) {
      // Offload to async execution
      setImmediate(async () => {
        await processCampaignBatch(camp);
      });
    }

  } catch (cronErr) {
    console.error('Cron Job Execution Error:', cronErr);
  }
});

// DISPATCH CAMPAIGN (Queues it instantly for the chron worker)
router.post('/send', async (req, res) => {
  console.log('Incoming Campaign Dispatch Request:', req.body);
  const { title, subject, group, senderEmail, htmlContent, cc, bcc } = req.body;
  
  try {
    if (!senderEmail) return res.status(400).json({ error: 'Sender email is required.' });
    if (!group) return res.status(400).json({ error: 'Target contact group is required.' });

    const activeContacts = await Contact.find({ group: { $regex: new RegExp(`^${group}$`, 'i') }, status: 'Active' });
    if (activeContacts.length === 0) {
      return res.status(400).json({ error: `No active verified contacts found in group "${group}".` });
    }

    const emailsToQueue = activeContacts.map(c => c.email);

    const campaign = new Campaign({ 
      title: title || subject || 'Broadcast', 
      subject, 
      group, 
      senderEmail, 
      htmlContent, 
      cc, 
      bcc, 
      status: 'Processing',
      pendingContacts: emailsToQueue,
      nextRunAt: new Date(), // Trigger first batch of 200 immediately
      sentAt: new Date() 
    });
    
    await campaign.save();
    res.status(200).json({ message: `Campaign successfully added to the 200/hr limit queue for ${emailsToQueue.length} recipients!` });

  } catch (err) {
    console.error('SMTP Broadcast Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SCHEDULE A NEW CAMPAIGN
router.post('/schedule', async (req, res) => {
  try {
    const { title, subject, group, senderEmail, htmlContent, cc, bcc, scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'Scheduled date and time is required.' });

    const localDate = new Date(scheduledAt);
    const utcEquivalent = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000));

    const campaign = new Campaign({
      title: title || subject || 'Scheduled Broadcast',
      subject, group, senderEmail, htmlContent, cc, bcc,
      status: 'Scheduled',
      scheduledAt: utcEquivalent,
      sentAt: utcEquivalent
    });

    await campaign.save();
    res.status(200).json({ message: 'Campaign successfully scheduled!', campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE / RESCHEDULE A SCHEDULED CAMPAIGN
router.put('/schedule/:id', async (req, res) => {
  try {
    const { title, subject, group, senderEmail, htmlContent, cc, bcc, scheduledAt } = req.body;
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign || campaign.status !== 'Scheduled') return res.status(404).json({ error: 'Campaign not found or already running.' });

    campaign.title = title || campaign.title;
    campaign.subject = subject || campaign.subject;
    campaign.group = group || campaign.group;
    campaign.senderEmail = senderEmail || campaign.senderEmail;
    campaign.htmlContent = htmlContent || campaign.htmlContent;
    campaign.cc = cc; campaign.bcc = bcc;
    
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate.getTime() < Date.now() - 60000) return res.status(400).json({ error: 'Time cannot be in the past.' });
      const utcEquivalent = new Date(scheduledDate.getTime() - (5.5 * 60 * 60 * 1000));
      campaign.scheduledAt = utcEquivalent;
    }

    await campaign.save();
    res.status(200).json({ message: 'Campaign updated successfully!', campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE / CANCEL A SCHEDULED CAMPAIGN
router.delete('/schedule/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    if (campaign.status === 'Scheduled') {
      await Campaign.findByIdAndDelete(req.params.id);
      return res.status(200).json({ message: 'Scheduled campaign cancelled.' });
    }
    res.status(400).json({ error: 'Only pending scheduled campaigns can be deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET ALL CAMPAIGNS
router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ scheduledAt: -1, sentAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;