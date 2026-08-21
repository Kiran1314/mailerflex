import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'signatures');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const SignatureSchema = new mongoose.Schema({
  emailId: { type: String, required: true, unique: true },
  htmlContent: { type: String, required: true },
  imagePath: String,
  updatedAt: { type: Date, default: Date.now }
});

const Signature = mongoose.models.Signature || mongoose.model('Signature', SignatureSchema);

router.post('/', upload.single('signatureImage'), async (req, res) => {
  try {
    const { emailId, htmlContent } = req.body;
    
    if (!emailId || emailId.trim() === '') {
      return res.status(400).json({ error: 'Valid emailId is required.' });
    }

    let finalHtml = htmlContent || '';
    let imagePath = req.file ? `/signatures/${req.file.filename}` : undefined;

    if (imagePath) {
      const absoluteImageUrl = `http://localhost:5000${imagePath}`;
      // Check if <img> tag is already present in htmlContent, if not append it cleanly
      if (!finalHtml.includes(absoluteImageUrl)) {
        finalHtml += `<br><img src="${absoluteImageUrl}" alt="Signature Image" style="max-width: 160px; width: 100%; height: auto; display: block; margin-top: 8px;" />`;
      }
    }

    const updateData = { htmlContent: finalHtml, updatedAt: new Date() };
    if (imagePath) updateData.imagePath = imagePath;

    const updated = await Signature.findOneAndUpdate(
      { emailId: emailId.trim() },
      updateData,
      { returnDocument: 'after', upsert: true }
    );
    res.json(updated);
  } catch (err) {
    console.error('Signature Save Error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const signatures = await Signature.find();
    res.json(signatures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;