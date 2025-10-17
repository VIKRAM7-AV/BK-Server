import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookedChit' },
  month: { type: Number },
  year: { type: Number },
  title: { type: String, required: true },
  body: { type: String, required: true },
  notificationId: { type: String },
  status: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
