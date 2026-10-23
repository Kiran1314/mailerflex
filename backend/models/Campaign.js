import mongoose from 'mongoose';

const CampaignSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  htmlContent: { type: String, required: true },
  senderEmailId: { type: String, required: true },
  pendingContacts: [{ type: String }],
  sentContacts: [{ type: String }],
  status: { type: String, enum: ['draft', 'running', 'completed'], default: 'draft' },
  nextRunAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);