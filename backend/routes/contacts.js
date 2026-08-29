import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const ContactSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  company: String,
  mobile: String,
  industry: String,
  group: { type: String, default: 'General' },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);

// GET all distinct contact groups
router.get('/groups', async (req, res) => {
  try {
    const groups = await Contact.distinct('group');
    const validGroups = groups.filter(g => g && g.trim() !== '');
    res.status(200).json(validGroups.length > 0 ? validGroups : ['General']);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  const results = [];
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  fs.createReadStream(req.file.path)
    .pipe(csv({
      mapHeaders: ({ header }) => header.toLowerCase().replace(/^\uFEFF/, '').trim()
    }))
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        let importedCount = 0;
        for (let row of results) {
          const email = row.email || row.Email;
          if (email && email.trim() !== '') {
            const name = row.name || row.Name || '';
            const company = row.company || row.Company || '';
            const mobile = row.mobile || row.mobileno || row.Mobile || '';
            const industry = row.industry || row.Industry || '';
            const group = row.group || row.Group || 'General';

            await Contact.updateOne(
              { email: email.trim() },
              { 
                $set: { 
                  name: name.trim(), 
                  company: company.trim(), 
                  mobile: mobile.trim(), 
                  industry: industry.trim(), 
                  group: (group.trim() !== '') ? group.trim() : 'General' 
                } 
              },
              { upsert: true }
            );
            importedCount++;
          }
        }
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(200).json({ message: `Successfully imported ${importedCount} contacts!` });
      } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
      }
    });
});

router.post('/', async (req, res) => {
  try {
    const { email, name, company, mobile, industry, group } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required.' });
    }

    const trimmedEmail = email.trim();
    const updatedContact = await Contact.findOneAndUpdate(
      { email: trimmedEmail },
      { 
        $set: { 
          name: name ? name.trim() : '', 
          company: company ? company.trim() : '', 
          mobile: mobile ? mobile.trim() : '', 
          industry: industry ? industry.trim() : '', 
          group: (group && group.trim() !== '') ? group.trim() : 'General' 
        } 
      },
      { new: true, upsert: true }
    );

    res.status(201).json(updatedContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, email, company, mobile, industry, group } = req.body;
    const updatedContact = await Contact.findByIdAndUpdate(
      req.params.id,
      { 
        name: name ? name.trim() : '', 
        email: email ? email.trim() : '', 
        company: company ? company.trim() : '', 
        mobile: mobile ? mobile.trim() : '', 
        industry: industry ? industry.trim() : '', 
        group: (group && group.trim() !== '') ? group.trim() : 'General' 
      },
      { new: true }
    );
    res.json(updatedContact);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE all contacts in a specific group (or all contacts if group is 'All')
router.delete('/group/all', async (req, res) => {
  try {
    const { group } = req.query;
    if (!group || group === 'All') {
      const result = await Contact.deleteMany({});
      return res.json({ message: `Successfully deleted all ${result.deletedCount} contacts.` });
    }

    const result = await Contact.deleteMany({ 
      group: { $regex: new RegExp(`^${group}$`, 'i') } 
    });
    res.json({ message: `Successfully deleted ${result.deletedCount} contacts from group [${group}].` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;