import express from 'express';
import EmailMessage from '../models/EmailMessage.js';
import Sender from '../models/Sender.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// 1. SAVE OR UPDATE DRAFT EMAIL
router.post('/save-draft', async (req, res) => {
  try {
    const { id, senderEmail, to, subject, bodyHtml, cc, bcc } = req.body;
    
    if (id) {
      const updatedDraft = await EmailMessage.findByIdAndUpdate(
        id,
        { 
          to: to || '', 
          subject: subject || '', 
          bodyHtml: bodyHtml || '', 
          cc: cc || '', 
          bcc: bcc || '', 
          date: Date.now() 
        },
        { returnDocument: 'after' }
      );
      return res.json({ message: 'Draft updated successfully!', draft: updatedDraft });
    }

    const newDraft = await EmailMessage.create({
      senderEmailId: senderEmail,
      folder: 'drafts',
      from: senderEmail,
      to: to || '',
      subject: subject || '',
      bodyHtml: bodyHtml || '',
      isRead: true,
      leadStage: 'New Lead'
    });

    res.status(201).json({ message: 'Saved as draft successfully!', draft: newDraft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. SEND / COMPOSE INDIVIDUAL EMAIL
router.post('/send-individual', async (req, res) => {
  try {
    const { senderEmail, to, subject, bodyHtml, cc, bcc } = req.body;
    
    const senderRecord = await Sender.findOne({ email: senderEmail });
    if (!senderRecord) return res.status(404).json({ error: 'Sender configuration not found.' });

    const transporter = nodemailer.createTransport({
      host: senderRecord.host,
      port: Number(senderRecord.port) || 587,
      secure: Number(senderRecord.port) === 465,
      auth: { user: senderRecord.email, pass: senderRecord.password },
      tls: { rejectUnauthorized: false }
    });

    let mailOptions = {
      from: `"${senderEmail.split('@')[0]}" <${senderRecord.email}>`,
      to,
      subject,
      html: bodyHtml
    };
    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    await transporter.sendMail(mailOptions);

    const sentMsg = await EmailMessage.create({
      senderEmailId: senderEmail,
      folder: 'sent',
      from: senderEmail,
      to,
      subject,
      bodyHtml,
      isRead: true,
      leadStage: 'Contacted'
    });

    res.status(200).json({ message: 'Email sent successfully!', sentMsg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. UPDATE / PATCH MESSAGE (Lead Stage, Read status, Flag, Pin, Folder movement)
router.patch('/message/:id', async (req, res) => {
  try {
    const { folder, isRead, leadStage, isFlagged, isPinned } = req.body;
    const updatePayload = {};

    if (folder !== undefined) updatePayload.folder = folder;
    if (isRead !== undefined) updatePayload.isRead = isRead;
    if (leadStage !== undefined) updatePayload.leadStage = leadStage;
    if (isFlagged !== undefined) updatePayload.isFlagged = isFlagged;
    if (isPinned !== undefined) updatePayload.isPinned = isPinned;

    const updated = await EmailMessage.findByIdAndUpdate(
      req.params.id, 
      { $set: updatePayload }, 
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('Backend Patch Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4. PERMANENTLY DELETE MESSAGE
router.delete('/message/:id', async (req, res) => {
  try {
    await EmailMessage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Email permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET MESSAGES FOR A SENDER AND FOLDER
router.get('/:senderEmail/:folder', async (req, res) => {
  try {
    const { senderEmail, folder } = req.params;
    const messages = await EmailMessage.find({ senderEmailId: senderEmail, folder }).sort({ date: -1 });
    const unreadCount = await EmailMessage.countDocuments({ senderEmailId: senderEmail, folder: 'inbox', isRead: false });
    
    res.json({ messages, unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;