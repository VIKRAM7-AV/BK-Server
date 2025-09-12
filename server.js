import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import ChitGroup from './Routes/ChitGroup.js';
import UserRoute from './Routes/UserRoute.js';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import NotificationRoute from './Routes/Notification.js';
import bodyParser from 'body-parser';
import * as firebaseServices from './firebaseServices.js';
import { Expo } from 'expo-server-sdk';

dotenv.config();

const app = express();

// Initialize Expo SDK
const expo = new Expo();

// Middleware
app.use(express.json());
app.use(cors({ origin: '*', credentials: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Routes
app.use('/api/chit-group', ChitGroup);
app.use('/api/user', UserRoute);
app.use('/api/notify', NotificationRoute);

// Save push token
app.post('/registerpushtoken', async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'User ID and token required' });
    }
    await firebaseServices.saveToken(userId, token);
    res.status(200).json({ success: true, message: 'Token saved' });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Send push notification
app.post('/getpushtoken', async (req, res) => {
  try {
    const userId = "68b8055418cf239372c1b92a"; // Replace with dynamic userId if needed
    const tokenData = await firebaseServices.getToken(userId);

    if (!tokenData || !tokenData.token) {
      return res.status(404).json({ success: false, message: 'Push token not found for user' });
    }

    const messages = [{
      to: tokenData.token,
      sound: 'default',
      title: 'Tesjuhhhhht',
      body: 'This is a test notification',
    }];

    // Send notifications
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }

    res.status(200).json({ success: true, message: 'Notification sent', tickets });
  } catch (error) {
    console.error('Error in /getpushtoken:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save Expo push token to MongoDB
app.post('/user/save-expo-token', async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'User ID and token required' });
    }

    const updatedUser = await User.updateOne(
      { _id: userId },
      { $set: { expoPushToken: token } }
    );

    if (updatedUser.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'Expo push token saved' });
  } catch (error) {
    console.error('Error saving Expo token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log('MongoDB Connected ✅');
  } catch (error) {
    console.error('MongoDB Error ❌', error.message);
    process.exit(1);
  }
};
connectDB();

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));