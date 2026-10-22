import mongoose from 'mongoose';

const EmailMessageSchema = new mongoose.Schema({
  senderEmailId: { type: String, required: true }, // The configured Sender Email (e.g., info@ibcstudio.com)
  folder: { 
    type: String, 
    enum: ['inbox', 'junk', 'drafts', 'sent', 'deleted', 'archive', 'outbox'], 
    default: 'inbox' 
  },
  from: { type: String, required: true },
  to: { type: String, required: true },
  subject: { type: String },
  bodyHtml: { type: String },
  isRead: { type: Boolean, default: false },
  isFlagged: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  leadStage: { 
    type: String, 
    enum: ['New Lead', 'Contacted', 'Warm Prospect', 'Negotiation', 'Converted', 'Closed/Junk'], 
    default: 'New Lead' 
  },
  date: { type: Date, default: Date.now }
});

export default mongoose.models.EmailMessage || mongoose.model('EmailMessage', EmailMessageSchema);