import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const CampaignSchema = new mongoose.Schema({
  title: String,
  subject: String,
  group: String,
  senderEmail: String,
  htmlContent: String,
  cc: String,
  bcc: String,
  status: { type: String, default: 'Sent' },
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
  email: String,
  company: String,
  mobile: String,
  industry: String,
  group: String
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

router.post('/send', async (req, res) => {
  console.log('Incoming Campaign Dispatch Request:', req.body);
  const { title, subject, group, senderEmail, htmlContent, cc, bcc } = req.body;
  
  try {
    if (!senderEmail) {
      return res.status(400).json({ error: 'Sender email is required.' });
    }
    if (!group) {
      return res.status(400).json({ error: 'Target contact group is required.' });
    }

    const senderRecord = await Sender.findOne({ email: senderEmail });
    if (!senderRecord) {
      return res.status(400).json({ error: `Sender configuration for ${senderEmail} not found in database.` });
    }

    const contacts = await Contact.find({ group: { $regex: new RegExp(`^${group}$`, 'i') } });
    if (contacts.length === 0) {
      return res.status(400).json({ error: `No contacts found in group "${group}".` });
    }

    // 1. Immediately save the Campaign document so it shows up in history instantly
    const campaign = new Campaign({ title: title || subject || 'Broadcast', subject, group, senderEmail, htmlContent, cc, bcc });
    await campaign.save();

    // 2. Respond immediately to the client to prevent gateway 504 timeout on production
    res.status(200).json({ message: `Campaign broadcast queued successfully for ${contacts.length} recipients!` });

    // 3. Process SMTP transmission asynchronously in the background queue
    setImmediate(async () => {
      try {
        const portNum = Number(senderRecord.port) || 465;
        const isSecure = portNum === 465;

        const transporter = nodemailer.createTransport({
          host: senderRecord.host || 'smtp.hostinger.com',
          port: portNum,
          secure: isSecure, // true for 465 (SSL), false for 587 (TLS)
          auth: { user: senderRecord.email, pass: senderRecord.password },
          tls: { rejectUnauthorized: false }
        });

        let processedHtml = htmlContent || '';
        let attachments = [];
        
        // Flexible regex to catch any signature image pointing to /signatures/ and convert to inline CID
        const imgRegex = /src="(?:https?:\/\/[^/]+)?(\/signatures\/[^"]+)"/g;
        let match;
        
        while ((match = imgRegex.exec(htmlContent)) !== null) {
          const fullMatchTag = match[0];
          const relativePath = match[1];
          const localFilePath = path.join(process.cwd(), relativePath);

          if (fs.existsSync(localFilePath)) {
            const uniqueCid = `sig-${Date.now()}-${Math.floor(Math.random() * 1000)}@mailer.local`;
            processedHtml = processedHtml.replace(fullMatchTag, `src="cid:${uniqueCid}"`);
            
            attachments.push({
              filename: path.basename(localFilePath),
              path: localFilePath,
              cid: uniqueCid
            });
          }
        }

        // Process recipient emails sequentially or in batches in the background
        for (const contact of contacts) {
          const logRecord = await CampaignLog.create({
            campaignTitle: title || subject || 'Untitled Campaign',
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

          personalizedHtml = personalizedHtml.replace(/href="([^"]+)"/g, (m, origUrl) => {
            if (origUrl.includes('https://mailer.ibcstudio.com/api/analytics')) return m;
            const clickTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/click?id=${logRecord._id}&url=${encodeURIComponent(origUrl)}`;
            return `href="${clickTrackerUrl}"`;
          });

          const openTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/open/${logRecord._id}`;
          const unsubscribeUrl = `https://mailer.ibcstudio.com/api/analytics/unsubscribe/${logRecord._id}`;

          personalizedHtml += `<img src="${openTrackerUrl}" width="1" height="1" style="display:none;" alt="" />`;
          personalizedHtml += `<br><p style="font-size: 11px; color: #888; text-align: center; margin-top: 20px;">Don't want these emails anymore? <a href="${unsubscribeUrl}" style="color: #555; text-decoration: underline;">Unsubscribe here</a>.</p>`;

          try {
            let mailOptions = {
              from: `"IBC Studio" <${senderRecord.email}>`,
              to: contact.email,
              subject: subject || 'Update from our Team',
              html: personalizedHtml,
              attachments: attachments
            };

            if (cc && cc.trim() !== '') mailOptions.cc = cc.trim();
            if (bcc && bcc.trim() !== '') mailOptions.bcc = bcc.trim();

            await transporter.sendMail(mailOptions);
            await CampaignLog.findByIdAndUpdate(logRecord._id, { status: 'Delivered' });
          } catch (mailErr) {
            console.error(`SMTP Dispatch Failed for ${contact.email}:`, mailErr.message);
            await CampaignLog.findByIdAndUpdate(logRecord._id, {
              status: 'Bounced',
              errorDetails: mailErr.message
            });
          }
        }
      } catch (bgErr) {
        console.error('Background Campaign Dispatch Error:', bgErr);
      }
    });

  } catch (err) {
    console.error('SMTP Broadcast Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ sentAt: -1 });
    res.json(campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RESEND CAMPAIGN TO BOUNCED RECIPIENTS ONLY
router.post('/resend-bounced', async (req, res) => {
  try {
    const { campaignId, bouncedEmails, title, subject, senderEmail, htmlContent, cc, bcc } = req.body;

    if (!bouncedEmails || bouncedEmails.length === 0) {
      return res.status(400).json({ error: 'No bounced email addresses provided.' });
    }

    const senderRecord = await Sender.findOne({ email: senderEmail });
    if (!senderRecord) {
      return res.status(404).json({ error: 'Sender configuration not found.' });
    }

    const portNum = Number(senderRecord.port) || 465;
    const isSecure = portNum === 465;

    const transporter = nodemailer.createTransport({
      host: senderRecord.host || 'smtp.hostinger.com',
      port: portNum,
      secure: isSecure,
      auth: { user: senderRecord.email, pass: senderRecord.password },
      tls: { rejectUnauthorized: false }
    });

    // Process re-sending asynchronously in background queue to prevent 504 gateway timeouts
    res.status(200).json({ message: `Resending campaign queue initiated for ${bouncedEmails.length} bounced recipient(s).` });

    setImmediate(async () => {
      for (const recipientEmail of bouncedEmails) {
        try {
          const logRecord = await CampaignLog.create({
            campaignTitle: title || subject || 'Resend Bounced Campaign',
            senderEmail: senderRecord.email,
            recipientEmail,
            status: 'Sent',
            opened: false,
            clicked: false,
            unsubscribed: false
          });

          let personalizedHtml = htmlContent || '';
          const openTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/open/${logRecord._id}`;
          const unsubscribeUrl = `https://mailer.ibcstudio.com/api/analytics/unsubscribe/${logRecord._id}`;

          personalizedHtml += `<img src="${openTrackerUrl}" width="1" height="1" style="display:none;" alt="" />`;
          personalizedHtml += `<br><p style="font-size: 11px; color: #888; text-align: center; margin-top: 20px;">Don't want these emails anymore? <a href="${unsubscribeUrl}" style="color: #555; text-decoration: underline;">Unsubscribe here</a>.</p>`;

          let mailOptions = {
            from: `"IBC Studio" <${senderRecord.email}>`,
            to: recipientEmail,
            subject: subject || 'Update from our Team',
            html: personalizedHtml
          };

          if (cc && cc.trim() !== '') mailOptions.cc = cc.trim();
          if (bcc && bcc.trim() !== '') mailOptions.bcc = bcc.trim();

          await transporter.sendMail(mailOptions);
          await CampaignLog.findByIdAndUpdate(logRecord._id, { status: 'Delivered' });
        } catch (mailErr) {
          console.error(`Failed to resend to ${recipientEmail}:`, mailErr.message);
        }
      }
    });

  } catch (err) {
    console.error('Resend Bounced Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;