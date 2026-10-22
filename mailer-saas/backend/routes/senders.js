import express from 'express';
import Sender from '../models/Sender.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { id, email, host, port, password, incomingHost, incomingPort, incomingProtocol } = req.body;
    const updatePayload = { 
      email, 
      host: host || 'smtp.hostinger.com', 
      port: Number(port) || 465, 
      password,
      incomingHost: incomingHost || 'pop.hostinger.com',
      incomingPort: Number(incomingPort) || 995,
      incomingProtocol: incomingProtocol || 'POP3'
    };

    if (id) {
      const updated = await Sender.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' });
      return res.json(updated);
    }
    
    const newSender = new Sender(updatePayload);
    await newSender.save();
    res.status(201).json(newSender);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const senders = await Sender.find().sort({ createdAt: -1 });
    res.json(senders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Sender.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sender email deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;