import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const CampaignLog = mongoose.models.CampaignLog || mongoose.model('CampaignLog', new mongoose.Schema({
  campaignTitle: String,
  senderEmail: String,
  recipientEmail: String,
  status: String,
  opened: { type: Boolean, default: false },
  clicked: { type: Boolean, default: false },
  unsubscribed: { type: Boolean, default: false },
  sentAt: { type: Date, default: Date.now }
}));

// 1. Track Email Open (Pixel)
router.get('/open/:id', async (req, res) => {
  try {
    await CampaignLog.findByIdAndUpdate(req.params.id, { opened: true });
    const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': img.length });
    res.end(img);
  } catch (err) {
    res.status(500).end();
  }
});

// 2. Track Link Click & Redirect
router.get('/click', async (req, res) => {
  try {
    const { id, url } = req.query;
    if (id) {
      await CampaignLog.findByIdAndUpdate(id, { clicked: true });
    }
    if (url) {
      return res.redirect(url);
    }
    res.status(400).send('Destination URL not specified.');
  } catch (err) {
    res.status(500).send('Error processing click redirection.');
  }
});

// 3. Track Unsubscribe
router.get('/unsubscribe/:id', async (req, res) => {
  try {
    await CampaignLog.findByIdAndUpdate(req.params.id, { unsubscribed: true });
    res.send(`<!DOCTYPE html><html><body style="font-family:sans-serif; text-align:center; padding-top:50px;"><h2>You have been successfully unsubscribed.</h2><p>We're sorry to see you go.</p></body></html>`);
  } catch (err) {
    res.status(500).send('Error processing unsubscription.');
  }
});

// 4. Get Real-Time Analytics Summary, Daily Trends & Logs
router.get('/', async (req, res) => {
  try {
    const logs = await CampaignLog.find().sort({ sentAt: -1 }).limit(200);
    const totalSent = await CampaignLog.countDocuments();
    const totalDelivered = await CampaignLog.countDocuments({ status: 'Delivered' });
    const totalBounced = await CampaignLog.countDocuments({ status: 'Bounced' });
    const totalOpened = await CampaignLog.countDocuments({ opened: true });
    const totalClicked = await CampaignLog.countDocuments({ clicked: true });
    const totalUnsubscribed = await CampaignLog.countDocuments({ unsubscribed: true });

    const deliveryRate = totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(1) : 0;
    const openRate = totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : 0;
    const clickRate = totalDelivered > 0 ? ((totalClicked / totalDelivered) * 100).toFixed(1) : 0;
    const unsubscribeRate = totalDelivered > 0 ? ((totalUnsubscribed / totalDelivered) * 100).toFixed(1) : 0;

    // Aggregate logs by date for Daily Trends & Calendar Filter
    const trendMap = {};
    const allLogs = await CampaignLog.find().sort({ sentAt: 1 });
    
    allLogs.forEach(log => {
      const dateStr = new Date(log.sentAt).toLocaleDateString();
      if (!trendMap[dateStr]) {
        trendMap[dateStr] = { date: dateStr, sent: 0, delivered: 0, bounced: 0 };
      }
      trendMap[dateStr].sent += 1;
      if (log.status === 'Delivered') trendMap[dateStr].delivered += 1;
      if (log.status === 'Bounced') trendMap[dateStr].bounced += 1;
    });

    const dailyTrends = Object.values(trendMap).reverse(); // Latest dates first

    res.json({
      summary: {
        totalSent,
        totalDelivered,
        totalBounced,
        totalOpened,
        totalClicked,
        totalUnsubscribed,
        deliveryRate,
        openRate,
        clickRate,
        unsubscribeRate
      },
      dailyTrends,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;