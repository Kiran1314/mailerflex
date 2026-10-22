import mongoose from 'mongoose';

const SenderSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  host: { type: String, default: 'smtp.hostinger.com' },
  port: { type: Number, default: 465 },
  password: { type: String, required: true },
  
  // New server detail columns with safe fallbacks
  incomingHost: { type: String, default: 'pop.hostinger.com' },
  incomingPort: { type: Number, default: 995 },
  incomingProtocol: { type: String, enum: ['IMAP', 'POP3'], default: 'POP3' },
  
  createdAt: { type: Date, default: Date.now }
});

// Delete cached model if it exists to force schema update
if (mongoose.models.Sender) {
  delete mongoose.models.Sender;
}

export default mongoose.model('Sender', SenderSchema);