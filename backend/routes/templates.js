import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const TemplateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: String,
  htmlContent: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema);

router.post('/', async (req, res) => {
  try {
    const { id, title, subject, htmlContent, isDefault } = req.body;

    if (isDefault) {
      await Template.updateMany({}, { isDefault: false });
    }

    if (id) {
      const updated = await Template.findByIdAndUpdate(
        id,
        { title, subject, htmlContent, isDefault },
        { new: true }
      );
      return res.json(updated);
    }

    const newTemplate = new Template({ title, subject, htmlContent, isDefault });
    await newTemplate.save();
    res.status(201).json(newTemplate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Template.findByIdAndDelete(req.params.id);
    res.json({ message: 'Template deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;