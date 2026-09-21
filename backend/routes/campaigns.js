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
  status: { type: String, enum: ['Scheduled', 'Processing', 'Sent', 'Cancelled'], default: 'Sent' },
  scheduledAt: { type: String, default: null }, // Changed to String
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


// Helper function to get current IST time string
function getISTTimestamp() {
  const now = new Date();
  // Format to IST string directly
  return now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
}



// Reusable Background Campaign Dispatch Worker (Exported for server-side fallback execution)
export async function processCampaignExecution(camp) {
  try {
    console.log(`[Cron Worker] Processing execution for campaign: "${camp.title}" (${camp._id})`);
    
    const senderRecord = await Sender.findOne({ email: camp.senderEmail });
    if (!senderRecord) {
      console.error(`[Cron Worker Error] Sender configuration for ${camp.senderEmail} not found.`);
      camp.status = 'Cancelled';
      await camp.save();
      return;
    }

    const contacts = await Contact.find({ 
      group: { $regex: new RegExp(`^${camp.group}$`, 'i') },
      status: 'Active' 
    });

    if (contacts.length === 0) {
      console.error(`[Cron Worker Error] No active verified contacts found in group "${camp.group}".`);
      camp.status = 'Cancelled';
      await camp.save();
      return;
    }

    const portNum = Number(senderRecord.port) || 465;
    const isSecure = portNum === 465;

    let processedHtml = camp.htmlContent || '';
    let attachments = [];
    
    // Safeguarded regex matching
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
          
          attachments.push({
            filename: path.basename(localFilePath),
            path: localFilePath,
            cid: uniqueCid
          });
        }
      }
    }

    camp.status = 'Sent';
    camp.sentAt = new Date();
    await camp.save();

    for (const contact of contacts) {
      const transporter = nodemailer.createTransport({
        host: senderRecord.host || 'smtp.hostinger.com',
        port: portNum,
        secure: isSecure,
        auth: { user: senderRecord.email, pass: senderRecord.password },
        tls: { rejectUnauthorized: false },
        pool: true,
        maxConnections: 1,
        maxMessages: 100
      });

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

        personalizedHtml = personalizedHtml.replace(/href="([^"]+)"/g, (m, origUrl) => {
          if (origUrl.includes('https://mailer.ibcstudio.com/api/analytics')) return m;
          const clickTrackerUrl = `https://mailer.ibcstudio.com/api/analytics/click?id=${logRecord._id}&url=${encodeURIComponent(origUrl)}`;
          return `href="${clickTrackerUrl}"`;
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
      } finally {
        transporter.close();
      }

      await new Promise(resolve => setTimeout(resolve, 400));
    }
    console.log(`[Cron Worker] Successfully finished campaign dispatch: "${camp.title}"`);
  } catch (err) {
    console.error('[Execution Worker Fatal Error]:', err.message);
  }
}

// BACKGROUND CRON JOB: Runs every minute on VPS server time
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    const dueCampaigns = await Campaign.find({ status: 'Scheduled', scheduledAt: { $lte: now } });

    if (dueCampaigns.length > 0) {
      console.log(`[Cron Pulse] Found ${dueCampaigns.length} due scheduled campaign(s) to dispatch.`);
    }

    for (const camp of dueCampaigns) {
      camp.status = 'Processing';
      await camp.save();
      processCampaignExecution(camp);
    }
  } catch (cronErr) {
    console.error('Cron Job Execution Error:', cronErr);
  }
});

 
// DISPATCH CAMPAIGN IMMEDIATELY
 
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

    const activeContactsCount = await Contact.countDocuments({ group: { $regex: new RegExp(`^${group}$`, 'i') }, status: 'Active' });
    if (activeContactsCount === 0) {
      return res.status(400).json({ error: `No active verified contacts found in group "${group}". Please run email verification first.` });
    }

    // Use standard Date directly without double-shifting
    const campaign = new Campaign({ 
      title: title || subject || 'Broadcast', 
      subject, 
      group, 
      senderEmail, 
      htmlContent, 
      cc, 
      bcc, 
      status: 'Sent',
      sentAt: new Date() 
    });
    await campaign.save();

    res.status(200).json({ message: `Campaign broadcast queued successfully for ${activeContactsCount} active recipients!` });

    setImmediate(async () => {
      await processCampaignExecution(campaign);
    });

  } catch (err) {
    console.error('SMTP Broadcast Error:', err);
    res.status(500).json({ error: err.message });
  }
});


 
// SCHEDULE A NEW CAMPAIGN
router.post('/schedule', async (req, res) => {
  try {
    const { title, subject, group, senderEmail, htmlContent, cc, bcc, scheduledAt } = req.body;
    
    if (!scheduledAt) {
      return res.status(400).json({ error: 'Scheduled date and time is required.' });
    }

    // Treat the incoming datetime-local string as IST and convert it to true UTC for database storage
    const localDate = new Date(scheduledAt);
    const utcEquivalent = new Date(localDate.getTime() - (5.5 * 60 * 60 * 1000));

    const campaign = new Campaign({
      title: title || subject || 'Scheduled Broadcast',
      subject,
      group,
      senderEmail,
      htmlContent,
      cc,
      bcc,
      status: 'Scheduled',
      scheduledAt: utcEquivalent, // Stores the adjusted UTC time so background check matches perfectly
      sentAt: utcEquivalent
    });

    await campaign.save();
    console.log(`[Campaign Scheduled] "${campaign.title}" saved successfully.`);
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

    if (!campaign || campaign.status !== 'Scheduled') {
      return res.status(404).json({ error: 'Scheduled campaign not found or already dispatched.' });
    }

    campaign.title = title || campaign.title;
    campaign.subject = subject || campaign.subject;
    campaign.group = group || campaign.group;
    campaign.senderEmail = senderEmail || campaign.senderEmail;
    campaign.htmlContent = htmlContent || campaign.htmlContent;
    campaign.cc = cc;
    campaign.bcc = bcc;
    
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate.getTime() < Date.now() - 60000) {
        return res.status(400).json({ error: 'Scheduled time cannot be in the past.' });
      }

      // Adjust local picker time to true UTC equivalent for storage
      const utcEquivalent = new Date(scheduledDate.getTime() - (5.5 * 60 * 60 * 1000));
      
      campaign.scheduledAt = utcEquivalent;
      campaign.sentAt = utcEquivalent;
    }

    await campaign.save();
    res.status(200).json({ message: 'Scheduled campaign updated successfully!', campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE / CANCEL A SCHEDULED CAMPAIGN
router.delete('/schedule/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Scheduled campaign not found.' });
    }

    if (campaign.status === 'Scheduled') {
      await Campaign.findByIdAndDelete(req.params.id);
      return res.status(200).json({ message: 'Scheduled campaign cancelled and deleted successfully.' });
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

    res.status(200).json({ message: `Resending campaign queue initiated for ${bouncedEmails.length} bounced recipient(s).` });

    setImmediate(async () => {
      for (const recipientEmail of bouncedEmails) {
        const transporter = nodemailer.createTransport({
          host: senderRecord.host || 'smtp.hostinger.com',
          port: portNum,
          secure: isSecure,
          auth: { user: senderRecord.email, pass: senderRecord.password },
          tls: { rejectUnauthorized: false },
          pool: true,
          maxConnections: 1,
          maxMessages: 100
        });

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
        } finally {
          transporter.close();
        }

        await new Promise(resolve => setTimeout(resolve, 400));
      }
    });

  } catch (err) {
    console.error('Resend Bounced Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;