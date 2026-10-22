import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const SignatureSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true },
  htmlContent: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Signature = mongoose.models.Signature || mongoose.model('Signature', SignatureSchema);

// GET all signatures
router.get('/', async (req, res) => {
  try {
    const signatures = await Signature.find();
    res.json(signatures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST or Upsert signature
router.post('/', upload.single('signatureImage'), async (req, res) => {
  try {
    const { emailId, htmlContent } = req.body;
    let finalHtml = htmlContent;

    if (req.file) {
      const targetDir = path.join(process.cwd(), 'signatures');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const newFileName = `${Date.now()}-${req.file.originalname}`;
      const targetPath = path.join(targetDir, newFileName);
      fs.renameSync(req.file.path, targetPath);

      const imageTag = `<img src="/signatures/${newFileName}" alt="Signature Image" style="max-width:100%; height:auto;" />`;
      finalHtml = `${htmlContent}<br>${imageTag}`;
    }

    const updatedSignature = await Signature.findOneAndUpdate(
      { emailId: emailId.trim() },
      { $set: { htmlContent: finalHtml } },
      { new: true, upsert: true }
    );

    res.status(200).json(updatedSignature);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// DELETE signature by ID
router.delete('/:id', async (req, res) => {
  try {
    await Signature.findByIdAndDelete(req.params.id);
    res.json({ message: 'Signature deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;