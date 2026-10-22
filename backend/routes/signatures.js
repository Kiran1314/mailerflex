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

    // 1. Strip hidden Microsoft Office / Word XML bloat that causes email clipping
    finalHtml = finalHtml.replace(/<!--[\s\S]*?-->/g, ''); 
    finalHtml = finalHtml.replace(/<o:p>[\s\S]*?<\/o:p>/gi, ''); 
    finalHtml = finalHtml.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, ''); 

    const targetDir = path.join(process.cwd(), 'signatures');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

    // 2. Extract Base64 images embedded in the pasted HTML, save them to disk, and inject the absolute URL
    finalHtml = finalHtml.replace(/<img([^>]*)src="data:image\/(png|jpeg|jpg|gif);base64,([^"]+)"([^>]*)>/gi, (match, prefix, ext, base64Data, suffix) => {
      const fileName = `sig-inline-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
      const filePath = path.join(targetDir, fileName);
      
      // Save the Base64 string as a physical image file
      fs.writeFileSync(filePath, base64Data, 'base64');
      
      // Return the HTML img tag with the clean, lightweight URL
      return `<img${prefix}src="${baseUrl}/signatures/${fileName}"${suffix}>`;
    });

    // 3. Handle standard file uploads (if used)
    if (req.file) {
      const newFileName = `${Date.now()}-${req.file.originalname}`;
      const targetPath = path.join(targetDir, newFileName);
      fs.renameSync(req.file.path, targetPath);

      const imageTag = `<img src="${baseUrl}/signatures/${newFileName}" alt="Signature Image" style="max-width:100%; height:auto;" />`;
      finalHtml = `${finalHtml}<br>${imageTag}`;
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