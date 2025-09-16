import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import ChitGroup from './Routes/ChitGroup.js';
import UserRoute from './Routes/UserRoute.js';
import cookieParser from 'cookie-parser';
import NotificationRoute from './Routes/Notification.js';
import bodyParser from 'body-parser';
import { Expo } from 'expo-server-sdk';
import EnquiryRoute from './Routes/EnquiryRoute.js';
import Notifications from './Routes/getNotification.js';

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

// Routes
app.use('/api/chit-group', ChitGroup);
app.use('/api/user', UserRoute);
app.use('/api/enquiry', EnquiryRoute);
app.use('/api', NotificationRoute);
app.use('/api/notification', Notifications );



app.use('/test', (req, res) => {
  res.send('API is working');
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