import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const SenderSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  host: { type: String, default: 'smtp.hostinger.com' },
  port: { type: Number, default: 587 },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Sender = mongoose.models.Sender || mongoose.model('Sender', SenderSchema);

// CREATE or UPDATE Sender Email
router.post('/', async (req, res) => {
  try {
    const { id, email, host, port, password } = req.body;
    if (id) {
      const updated = await Sender.findByIdAndUpdate(
        id,
        { email, host, port, password },
        { new: true }
      );
      return res.json(updated);
    }
    const newSender = new Sender({ email, host, port, password });
    await newSender.save();
    res.status(201).json(newSender);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// READ All Senders
router.get('/', async (req, res) => {
  try {
    const senders = await Sender.find().sort({ createdAt: -1 });
    res.json(senders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Sender
router.delete('/:id', async (req, res) => {
  try {
    await Sender.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sender email deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;