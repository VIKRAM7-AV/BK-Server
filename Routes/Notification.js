import express from "express";
import User from "../Model/UserModel.js";
import { saveNotificationId } from "../utils/notificationHelper.js";

const router = express.Router();

// Trigger monthly reminders for all users
router.post("/monthly", async (req, res) => {
  try {
    // Populate chits so bookingType/status are available
    const users = await User.find().populate("chits");

    const today = new Date();
    const month = today.getMonth() + 1; // 1-indexed
    const year = today.getFullYear();
    let remindersSent = 0;

    for (const user of users) {
      console.log("Processing user:", user._id);

      for (const chit of user.chits) {
        // Handle nested or top-level bookingType/status
        const bookingType = chit.bookingType || chit.chitId?.bookingType;
        const status = chit.status || chit.chitId?.status;

        console.log("  Chit:", chit._id, "BookingType:", bookingType, "Status:", status);

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

          // Check payments in chit.chitId.payments if exists
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

          // Schedule notification only if payment not found
          if (!foundPaid) {
            const notificationId = 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
            await saveNotificationId(user._id, chit._id, month, year, notificationId);
            remindersSent++;
            console.log(`    Notification scheduled for chit ${chit._id}`);
          } else {
            console.log(`    Payment already made for chit ${chit._id}, skipping notification`);
          }
        }
      }
    }

    res.json({ message: `Monthly reminders processed. Total scheduled: ${remindersSent}` });
  } catch (error) {
    console.error('Monthly reminder error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
