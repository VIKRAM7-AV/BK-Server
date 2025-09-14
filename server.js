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
import EnquiryRoute from './Routes/EnquiryRoute.js';
import User from './Model/UserModel.js';

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
app.use('/api/enquiry', EnquiryRoute);


app.post('/getpushtoken', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'Valid User ID required' });
    }

    console.log('Fetching push token for userId:', userId);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log('User found:', user);
    const pushToken = user.expoPushToken;

    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(404).json({ success: false, message: 'Push token not found or invalid' });
    }

    // Build message
    const messages = [{
      to: pushToken,
      sound: 'default',
      title: 'Test Notification',
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
        console.error('Error sending push notification for chunk:', error);
      }
    }

    res.status(200).json({ success: true, message: 'Notification sent', tickets });
  } catch (error) {
    console.error('Error in /getpushtoken:', error);
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