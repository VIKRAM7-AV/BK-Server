import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import ChitGroup from "../Backend/Routes/ChitGroup.js";
import UserRoute from "../Backend/Routes/UserRoute.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());

// Routes

app.use('/api/chit-group', ChitGroup);
app.use('/api/user', UserRoute);

app.get('/test', (req, res) => {
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


// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
