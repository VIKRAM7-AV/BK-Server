import express from "express";
import User from "../Model/UserModel.js";
import Notification from "../Model/notification.js";
import { Expo } from "expo-server-sdk";
import cron from "node-cron";

console.log("📢 Notification module loaded");
console.log("🕒 Server timezone:", process.env.TZ || "Not set");

const expo = new Expo();
const router = express.Router();

function formatAmount(value) {
  if (value >= 10000000) {
    return (value / 10000000).toFixed(2).replace(/\.00$/, '') + " Crore";
  } else if (value >= 100000) {
    return (value / 100000).toFixed(2).replace(/\.00$/, '') + " Lakh";
  } else {
    return value.toString();
  }
}

const processMonthlyReminders = async () => {
  try {
    console.log(
      "⏰ processMonthlyReminders function called at",
      new Date().toLocaleString()
    );
    const today = new Date();
    const day = today.getUTCDate(); // 1 to 31
    console.log(`⏱ Today is ${day}`);

    if (day < 11 || day > 19) {
      console.log(`⏱ Today is ${day}, outside 11-19 range. Skipping job.`);
      return;
    }

    console.log(`🚀 Running monthly reminder job on day ${day}`);

    // ✅ Nested populate: chits and chitId
    const users = await User.find().populate({
      path: "chits",
      populate: {
        path: "chitId",
      },
    });

    console.log(`👥 Found ${users.length} users`);

    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getUTCFullYear();

    let remindersSent = 0;
    let notificationsSaved = 0;

    for (const user of users) {
      console.log(`👤 Processing user: ${user.name}`);
      for (const chit of user.chits) {
        const bookingType = chit.bookingType || chit.chitId?.bookingType;
        const chitStatus = chit.status || chit.chitId?.status;
        console.log(
          `📋 Chit ID: ${chit._id}, Booking Type: ${bookingType}, Status: ${chitStatus}`
        );

        if (bookingType === "monthly" && chitStatus === "active") {
          const auctionEntry = chit.chitId?.auctionTable?.find(
            (a) => Number(a.month) === chit?.payments.length + 1
          );

          if (!auctionEntry) {
            console.log(
              `⏩ Skipping chit ${chit._id} for user ${user.name}. No auction entry for month ${chit?.payments.length + 1}`
            );
            continue;
          }

          const dueAmount = auctionEntry.dueAmount || 0;

          const paymentsArray = Array.isArray(chit.payments)
            ? chit.payments
            : [];
          const paymentForThisMonth = paymentsArray.find((p) => {
            const date = new Date(p.date);
            return (
              date.getUTCMonth() + 1 === currentMonth &&
              date.getUTCFullYear() === currentYear &&
              p.status === "paid"
            );
          });

          if (paymentForThisMonth) {
            console.log(
              `✅ User ${user.name} already paid for month ${currentMonth}. No reminder.`
            );
            continue;
          }

          const chitValueFormatted = formatAmount(chit?.chitId?.chitValue || 0);
          const notificationMessage = `Your monthly payment of chit ${chitValueFormatted} for month ${chit?.payments.length + 1} is pending. Due Amount: ${dueAmount}. Please complete it.`;
          const notificationType = "remainder";
          const notificationId = `notif-${Date.now()}-${Math.floor(
            Math.random() * 10000
          )}`;

          // const notification = new Notification({
          //   notificationId,
          //   userId: user._id,
          //   chitId: chit._id,
          //   type: notificationType,
          //   month: currentMonth,
          //   year: currentYear,
          //   title: "Monthly Payment Reminder",
          //   body: notificationMessage,
          //   status: "pending",
          // });

          // await notification.save();
          // notificationsSaved++;

          if (user.expoPushToken) {
            const message = [
              {
                to: user.expoPushToken,
                sound: "default",
                title: "Monthly Payment Reminder",
                body: notificationMessage,
                data: {
                  chitId: chit._id,
                  month: currentMonth,
                  year: currentYear,
                  notificationId,
                  title: "Monthly Payment Reminder",
                  body: notificationMessage,
                  type: notificationType,
                  status: "pending",
                },
              },
            ];

            const chunks = expo.chunkPushNotifications(message);
            for (const chunk of chunks) {
              try {
                await expo.sendPushNotificationsAsync(chunk);
                console.log(
                  `✅ Reminder sent to ${user.name} for chit ${chit._id}`
                );
                remindersSent++;
              } catch (error) {
                console.error(
                  `❌ Error sending notification to ${user.name}:`,
                  error
                );
              }
            }
          } else {
            console.log(
              `⚠️ No push token for ${user.name}, reminder saved but not sent.`
            );
          }
        } else {
          console.log(
            `⏩ Skipping chit ${chit._id} for user ${user.name}. Not monthly or not active`
          );
        }
      }
    }

    console.log(
      `✅ Monthly job completed. Notifications saved: ${notificationsSaved}, reminders sent: ${remindersSent}`
    );
    console.log("Today:", today);
    console.log("Current month:", currentMonth);
  } catch (error) {
    console.error("❌ Error in monthly reminder job:", error);
  }
};

// ✅ Cron job for 12:31 PM IST (06:31 UTC) on 11-19th of every month
cron.schedule("10 13 11-19 * *", () => {
  console.log("⏰ Cron job triggered for monthly reminders at 12:31 IST");
  processMonthlyReminders();
});

// ✅ Optional API route to trigger manually
router.post("/monthly", async (req, res) => {
  await processMonthlyReminders();
  res.status(200).json({ message: "Monthly reminder job triggered manually." });
});

export default router;
