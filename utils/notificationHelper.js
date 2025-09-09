import Notification from '../Model/notification.js';
import  Notifications  from 'expo-server-sdk';

// Save notification record
async function saveNotificationId(userId, chitId, month, year, notificationId) {
  const notification = new Notification({
    userId,
    chitId,
    month,
    year,
    notificationId,
    status: 'scheduled'
  });
  await notification.save();
}

// Cancel notification
async function cancelNotificationForUser(chitId, month, year) {
  const notif = await Notification.findOne({ chitId, month, year, status: 'scheduled' });
  if (notif) {
    await Notifications.cancelScheduledNotificationAsync(notif.notificationId);
    notif.status = 'canceled';
    await notif.save();
  }
}

export { saveNotificationId, cancelNotificationForUser };
