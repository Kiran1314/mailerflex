import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Plain text or hashed (matches simple setup)
  name: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Seed default admin account if none exists
async function seedDefaultAdmin() {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      email: 'abhishek.banerjee@ibcstudio.com',
      password: 'abhishek123', // Change your default password here
      name: 'Abhishek Banerjee'
    });
    console.log('Default admin user seeded: abhishek.banerjee@ibcstudio.com / abhishek123');
  }
}
seedDefaultAdmin();

// Login Endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email address or password.' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Login successful!', 
      user: { email: user.email, name: user.name } 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;