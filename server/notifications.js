import cron from "node-cron";
import * as Expo from "expo-server-sdk";
import axios from "axios";
import Notification from "../Model/notification.js";
import { connectDB } from "../server.js";

connectDB();

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const allowedDays = [10, 11, 12, 13, 14, 15];

async function sendPaymentReminders() {
  const today = new Date();
  const day = today.getDate();

  if (!allowedDays.includes(day)) {
    console.log("Today is not a reminder date. Skipping.");
    return;
  }

  try {
    const response = await axios.get(`${API_BASE}/api/notify/monthly`);
    const pendingUsers = response.data;

    const expo = new Expo.Expo();
    const messages = [];

    for (const user of pendingUsers) {
      messages.push({
        to: user.pushToken,
        sound: "default",
        title: "Payment Reminder",
        body: `Hi! Your Chit payment for ${user.month}/${user.year} is still pending. Please pay ASAP!`,
        data: { type: "payment_reminder", chitId: user.chitId, month: user.month, year: user.year },
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    for (let i = 0; i < pendingUsers.length; i++) {
      const user = pendingUsers[i];
      const ticket = tickets[i];

      if (ticket.status === "ok") {
        const notif = new Notification({
          userId: user.userId,
          chitId: user.chitId,
          month: user.month,
          year: user.year,
          notificationId: ticket.id,
          status: "sent",
          type: "payment_reminder",
        });
        await notif.save();
        console.log(`Reminder sent and saved for user ${user.userId}, chit ${user.chitId}`);
      } else {
        console.error(`Failed to send for user ${user.userId}: ${ticket.message}`);
      }
    }
  } catch (error) {
    console.error("Failed to send reminders:", error);
  }
}

cron.schedule("0 9 10-15 * *", sendPaymentReminders, {
  timezone: "Asia/Kolkata",
});