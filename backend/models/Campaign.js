import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema({
  title: String,
  subject: String,
  group: String,
  senderEmail: String,
  htmlContent: String,
  cc: String,
  bcc: String,
  status: { 
    type: String, 
    enum: ['Scheduled', 'Processing', 'Sent', 'Cancelled'], 
    default: 'Scheduled' 
  },
  scheduledAt: { type: Date, default: null }, 
  
  // Queue tracking fields for hourly limits
  pendingContacts: { type: [String], default: [] },
  sentContacts: { type: [String], default: [] },
  nextRunAt: { type: Date, default: null },

  sentAt: { type: Date, default: Date.now }
});

export default mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);