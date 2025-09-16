import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chitId: { type: mongoose.Schema.Types.ObjectId, ref: 'BookedChit', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  notificationId: { type: String, required: true },
  status: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', NotificationSchema);

export default Notification;
