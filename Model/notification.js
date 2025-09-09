import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookedChit', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  notificationId: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'sent', 'canceled'], default: 'scheduled' },
  type: { type: String, default: 'payment_reminder' }, 
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
