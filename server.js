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
import AgentRoute from './Routes/agentRoute.js';
import WorkerRoute from './Routes/WorkerRoute.js';
import TaskRoute from './Routes/TaskRoute.js';
import DailyRoute from './Routes/DailyRoute.js';
import MonthlyRoute from './Routes/MonthlyRoute.js';
import cron from 'node-cron';
import chitGroup from './Model/ChitGroup.js';
import {BookedChit} from './Model/BookedChit.js'; // Adjust path to models
import { getMonthIndex } from './utils/dateUtils.js'; // Import from utilities file

dotenv.config();

const app = express(
  { limit: '50mb' }
);

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
app.use('/api/notification', Notifications);
app.use('/api/agent', AgentRoute);
app.use("/api/route",WorkerRoute);
app.use("/api/task",TaskRoute);
app.use("/api/dailycollection",DailyRoute)
app.use('/api/monthlycollection',MonthlyRoute);



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



// // Cron: Run at 00:00 on the 10th of every month for adding dues
// cron.schedule('0 0 10 * *', async () => {
//   try {
//     const activeBookedChits = await BookedChit.find({ status: 'active' });
//     for (const bookedChit of activeBookedChits) {
//       const chitGroup = await ChitGroup.findById(bookedChit.chitId);
//       if (!chitGroup) continue;

//       const monthIndex = getMonthIndex(bookedChit.month);
//       if (monthIndex > chitGroup.durationMonths || monthIndex <= bookedChit.lastDueAddedMonth) continue;

//       const tableEntry = chitGroup.auctionTable[monthIndex - 1];
//       if (!tableEntry) continue;

//       bookedChit.pendingAmount += tableEntry.dueAmount;
//       bookedChit.lastDueAddedMonth = monthIndex;
//       await bookedChit.save();
//     }
//     console.log('Monthly dues added successfully on the 1st');
//   } catch (error) {
//     console.error('Error in monthly due cron:', error);
//   }
// });




// Cron: Run at 00:00 on the 16th of every month for adding penalties to monthly chits
// cron.schedule('0 0 16 * *', async () => {
//   try {
//     const activeMonthlyChits = await BookedChit.find({ status: 'active', bookingType: 'monthly' });
//     for (const bookedChit of activeMonthlyChits) {
//       const chitGroup = await ChitGroup.findById(bookedChit.chitId);
//       if (!chitGroup) continue;

//       const monthIndex = getMonthIndex(bookedChit.month);
//       if (monthIndex > chitGroup.durationMonths) continue;

//       const tableEntry = chitGroup.auctionTable[monthIndex - 1];
//       if (!tableEntry) continue;

//       const monthPaid = bookedChit.payments
//         .filter((p) => p.monthIndex === monthIndex && p.status === 'paid')
//         .reduce((sum, p) => sum + p.amount, 0);

//       if (monthPaid > 0) continue; // Already paid something, skip

//       const hasPenalty = bookedChit.payments.some(
//         (p) => p.monthIndex === monthIndex && p.status === 'due' && p.amount === tableEntry.dividend
//       );

//       if (hasPenalty) continue;

//       await BookedChit.findByIdAndUpdate(bookedChit._id, {
//         $inc: { PenaltyAmount: tableEntry.dividend },
//       });
//     }
//     console.log('Monthly penalties added successfully on the 16th');
//   } catch (error) {
//     console.error('Error in monthly penalty cron:', error);
//   }
// });




// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));