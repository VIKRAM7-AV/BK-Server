import express from "express";
import User from "../Model/UserModel.js";
import Notification from "../Model/notification.js";
import { saveNotificationId } from "../utils/notificationHelper.js";
import { Expo } from "expo-server-sdk";

const expo = new Expo();
const router = express.Router();

router.post("/monthly", async (req, res) => {
  try {
    const users = await User.find().populate("chits");

    const today = new Date();
    const month = today.getUTCMonth() + 1; // 1-indexed, UTC
    const year = today.getUTCFullYear();
    let remindersSent = 0;
    let notificationsSaved = 0;

    for (const user of users) {
      for (const chit of user.chits) {
        const bookingType = chit.bookingType || chit.chitId?.bookingType;
        const status = chit.status || chit.chitId?.status;

        if (bookingType === "monthly" && status === "active") {
          let foundPaid = false;

          // Check payments in chit.payments
          if (Array.isArray(chit.payments)) {
            for (const p of chit.payments) {
              const paymentDate = new Date(p.date);
              if (
                paymentDate.getUTCMonth() + 1 === month &&
                paymentDate.getUTCFullYear() === year &&
                p.status === "paid"
              ) {
                foundPaid = true;
                break;
              }
            }
          }

          // Check payments in chit.chitId.payments
          if (!foundPaid && chit.chitId && Array.isArray(chit.chitId.payments)) {
            for (const p of chit.chitId.payments) {
              const paymentDate = new Date(p.date);
              if (
                paymentDate.getUTCMonth() + 1 === month &&
                paymentDate.getUTCFullYear() === year &&
                p.status === "paid"
              ) {
                foundPaid = true;
                break;
              }
            }
          }

          // Prepare message based on payment status (send for both paid and unpaid)
          const notificationMessage = foundPaid
            ? `Payment completed for chit ${chit._id}.`
            : `Your monthly payment for chit ${chit._id} is pending. Please complete it.`;
          const notificationType = foundPaid ? "payment_completed" : "remainder";

          // Generate notificationId
          const notificationId = `notif-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

          // Save notification in DB (now with notificationId)
          const notification = new Notification({
            notificationId, // Pass it here to satisfy validation
            userId: user._id,
            chitId: chit._id,
            type: notificationType,
            message: notificationMessage,
            month,
            year,
            createdAt: new Date(),
          });
          await notification.save();
          notificationsSaved++;
          await saveNotificationId(user._id, chit._id, month, year, notificationId);

          // Send notification if push token exists
          if (user.expoPushToken) {
            const message = [{
              to: user.expoPushToken,
              sound: 'default',
              title: foundPaid ? 'Payment Completed' : 'Monthly Payment Reminder',
              body: notificationMessage,
              data: { 
                chitId: chit._id, 
                month, 
                year, 
                notificationId,
                type: notificationType 
              }
            }];

            const chunks = expo.chunkPushNotifications(message);
            for (const chunk of chunks) {
              await expo.sendPushNotificationsAsync(chunk);
            }

            remindersSent++;
            console.log(`✅ Notification sent for chit ${chit._id}: ${notificationMessage}`);
          } else {
            console.log(`⚠️ No push token for user ${user.name}, notification saved for chit ${chit._id} but not sent`);
          }
        } else {
          console.log(`⏩ Skipped chit ${chit._id} for user ${user.name}: Not monthly or not active`);
        }
      }
    }

    res.json({ 
      message: `Monthly reminders processed. Notifications saved: ${notificationsSaved}, sent: ${remindersSent}` 
    });
  } catch (error) {
    console.error('Monthly reminder error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;