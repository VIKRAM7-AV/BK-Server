import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import ChitGroup from "../Backend/Routes/ChitGroup.js";
import UserRoute from "../Backend/Routes/UserRoute.js";
import cookieParser from 'cookie-parser';
import morgan from "morgan";
import NotificationRoute from "../Backend/Routes/Notification.js";


dotenv.config();

const app = express();

app.use(express.json());
app.use(cors({ origin: "*", credentials: true }));
app.use(cookieParser());

// Routes


app.use('/api/chit-group', ChitGroup);
app.use('/api/user', UserRoute);
app.use('/api/notify', NotificationRoute);

app.get('/api/test', (req, res) => {
  res.send('Hello Backend is Work 🚀');
});


// DB connect
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URI);
        console.log("MongoDB Connected ✅");
    } catch (error) {
        console.error("MongoDB Error ❌", error.message);
        process.exit(1);
    }
};
connectDB();


// Show method, URL, status, and response time in ms
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));


// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`, ));
    