import { BookedChit } from "../Model/BookedChit.js";
import Admin from "../Model/AdminModal.js";
import User from "../Model/UserModel.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/jwt.js";
import bcrypt from "bcrypt";
import DailyCollection from "../Model/DailyCollectionModel.js";
import MonthlyCollection from "../Model/MonthlyCollectionModel.js";
import dotenv from "dotenv";
import OTPVerification from "../Model/OTPVerification.js";
import nodemailer from "nodemailer";
import Agent from "../Model/AgentModal.js";

dotenv.config();

export const NewAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(409).json({ message: "Admin already exists" });
    }

    const getsalt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, getsalt);

    const admin = new Admin({ name, email, password: hashedPassword });
    await admin.save();
    res.status(200).json({ message: "Admin created successfully" });
  } catch (error) {
    console.error("New admin error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const RefreshTokenCon = async (req, res) => {
  try {
    const { refreshTokenAdmin } = req.body;
    if (!refreshTokenAdmin) {
      return res.status(400).json({ message: "Refresh token required" });
    }
    let decoded;
    try {
      decoded = verifyToken(refreshTokenAdmin);
    } catch (err) {
      return res
        .status(401)
        .json({ message: "Invalid or expired refresh token" });
    }
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    const accessTokenAdmin = signAccessToken(admin._id);
    res.status(200).json({ accessTokenAdmin });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const Getme = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json({ admin });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const LoginAdmin = async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) {
      return res.status(400).json({ message: "Name & password required" });
    }
    const admin = await Admin.findOne({ name }).select("+password");
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const accessTokenAdmin = signAccessToken(admin._id);
    const refreshTokenAdmin = signRefreshToken(admin._id);
    res.status(200).json({
      success: true,
      message: "Login successful",
      admin: {
        id: admin._id,
        name: admin.name,
      },
      accessTokenAdmin,
      refreshTokenAdmin,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getallUsers = async (req, res) => {
  try {
    const { fields, role } = req.query;

    // Build the query
    let query = User.find();

    // Apply role filter if provided
    if (role) {
      query = query.where("role").equals(role);
    }

    // Select fields dynamically or exclude sensitive ones
    const selectFields = fields
      ? fields.split(",").join(" ")
      : "-password -expoPushToken";

    const users = await query
      .select(selectFields)
      .populate({
        path: "chits",
        populate: {
          path: "chitId",
          select:
            "groupCode chitValue durationMonths monthlyContribution dailyContribution totalDueAmount totalDividend",
        },
      })
      .populate("agent", "name phone agentId")
      .populate("nominee", "name dob relation phone permanentAddress")
      .populate("route", "place")
      .populate({
        path: "chits",
        populate: { path: "auction" },
      })
      .lean(); // Convert to plain JavaScript object for better performance

    // Check if route.name is missing and handle it
    users.forEach((user) => {
      if (user.route && !user.route.name) {
        user.route.name = "Unknown"; // Fallback value
      }
    });

    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res
      .status(200)
      .json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message:
        error.name === "CastError"
          ? "Invalid data provided"
          : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getdailyChitusers = async (req, res) => {
  try {
    const dailychitusers = await BookedChit.find({ bookingType: "daily" })
      .populate({
        path: "userId",
        select: "-password -expoPushToken",
        populate: [
          { path: "auction" },
          { path: "agent", select: "name phone" },
          { path: "route", select: "place" },
        ],
      })
      .populate({
        path: "chitId",
        select: "chitValue",
      })
      .lean();

    res
      .status(200)
      .json({
        message: "Daily chit users fetched successfully",
        data: dailychitusers,
      });
  } catch (error) {
    console.error("Error fetching daily chit users:", error);
    res.status(500).json({
      message:
        error.name === "CastError"
          ? "Invalid data provided"
          : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getdailyChitusersReport = async (req, res) => {
  try {
    const dailyCollections = await DailyCollection.find({})
      .populate({
        path: "days.payments.bookedChit",
        populate: { path: "userId" },
      })
      .populate("routeId");

    if (!dailyCollections || dailyCollections.length === 0) {
      return res.status(404).json({ message: "Daily collections not found" });
    }

    res
      .status(200)
      .json({
        message: "Daily chit users report fetched successfully",
        data: dailyCollections,
      });
  } catch (error) {
    console.error("Error generating daily chit users report:", error);
    res.status(500).json({
      message:
        error.name === "CastError"
          ? "Invalid data provided"
          : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getmonthlyChitusers = async (req, res) => {
  try {
    const monthlychitusers = await BookedChit.find({ bookingType: "monthly" })
      .populate({
        path: "userId",
        select: "-password -expoPushToken",
        populate: [
          { path: "auction" },
          { path: "agent", select: "name phone" },
          { path: "route", select: "place" },
        ],
      })
      .populate({
        path: "chitId",
        select: "chitValue",
      })
      .lean();

    res
      .status(200)
      .json({
        message: "Monthly chit users fetched successfully",
        data: monthlychitusers,
      });
  } catch (error) {
    console.error("Error fetching monthly chit users:", error);
    res.status(500).json({
      message:
        error.name === "CastError"
          ? "Invalid data provided"
          : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getmonthlyChitusersReport = async (req, res) => {
  try {
    const monthlyCollections = await MonthlyCollection.find({})
      .populate({
        path: "months.payments.bookedChit",
        model: BookedChit,
        populate: [
          { path: "userId" },
          { path: "chitId", select: "chitValue totalDueAmount" },
        ],
      })
      .populate("agentId");

    if (!monthlyCollections || monthlyCollections.length === 0) {
      return res.status(404).json({ message: "Monthly collections not found" });
    }

    res
      .status(200)
      .json({
        message: "Monthly chit users report fetched successfully",
        data: monthlyCollections,
      });
  } catch (error) {
    console.error("Error generating monthly chit users report:", error);
    res.status(500).json({
      message:
        error.name === "CastError"
          ? "Invalid data provided"
          : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const GetCountUsers = async (req, res) => {
  try {
    // Keep totalUsers if needed, or remove if focusing only on chits
    const totalUsers = await User.countDocuments({ status: "active" });

    const totalDailyChitUsers = await BookedChit.find({
      bookingType: "daily",
      status: { $in: ["active"] },
    })
      .populate({
        path: "chitId",
        select: "chitValue",
      })
      .lean();

    const totalMonthlyChitUsers = await BookedChit.find({
      bookingType: "monthly",
      status: { $in: ["active"] },
    })
      .populate({
        path: "chitId",
        select: "chitValue",
      })
      .lean();

    // Compute counts
    const dailyChitCount = totalDailyChitUsers.length;
    const monthlyChitCount = totalMonthlyChitUsers.length;

    // Compute total chitValue sums
    const totalDailyChitValue = totalDailyChitUsers.reduce(
      (sum, user) => sum + (user.chitId?.chitValue || 0),
      0
    );
    const totalMonthlyChitValue = totalMonthlyChitUsers.reduce(
      (sum, user) => sum + (user.chitId?.chitValue || 0),
      0
    );

    res.status(200).json({
      totalUsers,
      dailyChitCount,
      monthlyChitCount,
      totalDailyChitValue,
      totalMonthlyChitValue,
    });
  } catch (error) {
    console.error("Error getting user counts:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// OTP Section

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper: generate 4-digit OTP
function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// Helper: hash OTP with salt using bcrypt (slower but safe)
async function hashOtp(otp) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(otp, salt);
}

const Email = process.env.FROM_EMAIL;

export const SendOTP = async (req, res) => {
  try {
    // Prefer an explicit target email in the request body, fallback to configured FROM_EMAIL
    const email = req.body && req.body.email ? req.body.email : Email;

    // In-memory OTP store (per-process). Consider a persistent store for production.
    const otps = new Map();

    const record = otps.get(email);
    if (record && record.attempts >= 5) {
      const wait = Math.ceil((record.expiresAt - Date.now()) / 60000);
      if (wait > 0)
        return res
          .status(429)
          .json({ message: `Too many requests. Try after ${wait} minutes` });
    }

    // Generate OTP, hash it, compute expiry, then store the record
    const otp = generateOtp();
    const hashedOtp = await hashOtp(otp);
    const ttlMinutes = Number(process.env.OTP_EXPIRY_MIN || 5);
    const expiry = Date.now() + ttlMinutes * 60 * 1000;

    otps.set(email, { otp, attempts: 0, expiresAt: expiry });

    await OTPVerification.findOneAndUpdate(
      { email },
      { otp: hashedOtp, expiry },
      { upsert: true, new: true }
    );

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: "Your OTP to reset password",
      html: `
    <html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Request</title>
</head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px;">
        <!-- Logo -->
        <img src="https://res.cloudinary.com/dqswseznh/image/upload/v1763015134/bk_lzwag7.png" alt="Company Logo" style="max-width: 100px; height: auto; display: block; margin: 0 auto 20px;" />
       
        <h2 style="color: #333; text-align: center; margin: 0 0 20px;">Password Reset Request</h2>
       
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
            We received a request to reset your password.
        </p>
       
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
            <strong>Your OTP is: <span style="color: #cb6500ff; font-size: 24px; letter-spacing: 3px;">${otp}</span></strong>
        </p>
       
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 20px;">
            This OTP will expire in <strong>${ttlMinutes} minutes</strong>.
        </p>
       
       
        <p style="color: #666; font-size: 16px; line-height: 1.5; margin: 0 0 30px;">
            If you didn't request this, please ignore this email.
        </p>
       
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
       
        <p style="color: #999; font-size: 14px; text-align: center; margin: 0;">
            &copy; 2025 BK Chits Private Limited. All rights reserved.
        </p>
    </div>
</body>
</html>
  `,
    });

    // Do NOT log the OTP in production. For debug only:
    console.log("OTP sent to", email, "messageId:", info.messageId);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const VerifyOTP = async (req, res) => {
  try {
    const email = Email;
    const { otp } = req.body;

    const record = await OTPVerification.findOne({ email });
    if (!record) {
      return res
        .status(400)
        .json({ message: "No OTP request found for this email" });
    }
    if (record.expiry < Date.now()) {
      return res.status(400).json({ message: "OTP has expired" });
    }
    const isMatch = await bcrypt.compare(otp, record.otp);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const ResetPassword = async (req, res) => {
  try {
    const email = Email;
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }
    const getsalt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, getsalt);
    const admin = await Admin.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const DueList = async (req, res) => {
  try {
    const dueUsers = await BookedChit.find({ status: "active" })
      .populate({
        path: "userId",
        select: "-password -expoPushToken -createdAt -updatedAt -nominee",
        populate: [
          {
            path: "agent",
            select: "name",
          },
          {
            path: "route",
            select: "place",
          },
        ],
      })
      .populate("chitId", "chitValue durationMonths groupCode")
      .lean();

    res
      .status(200)
      .json({ message: "Due list fetched successfully", data: dueUsers });
  } catch (error) {
    console.error("Error fetching due list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const ArrearList = async (req, res) => {
  try {
    const ArrearUsers = await BookedChit.find({ status: "arrear" })
      .populate({
        path: "userId",
        select: "-password -expoPushToken -createdAt -updatedAt -nominee",
        populate: [
          {
            path: "agent",
            select: "name",
          },
          {
            path: "route",
            select: "place",
          },
        ],
      })
      .populate("chitId", "chitValue durationMonths groupCode")
      .lean();

    res
      .status(200)
      .json({ message: "Arrear list fetched successfully", data: ArrearUsers });
  } catch (error) {
    console.error("Error fetching due list:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const AllAgents = async (req, res) => {
  try {
    // Step 1: Find all agents
    const agents = await Agent.find({ role: "agent" })
      .select("-password -createdAt -updatedAt -__v -expoPushToken ")
      .populate({
        path: "route",
        select: "place",
      })
      .lean();

    // Step 2: Get all agent _id's
    const agentIds = agents.map((agent) => agent._id);

    // Step 3: Aggregate to count users per agent (one query only!)
    const userCounts = await User.aggregate([
      { $match: { agent: { $in: agentIds } } },
      {
        $group: {
          _id: "$agent",
          userCount: { $sum: 1 },
        },
      },
    ]);

    // Step 4: Convert to map for O(1) lookup
    const userCountMap = {};
    userCounts.forEach((item) => {
      userCountMap[item._id.toString()] = item.userCount;
    });

    // Step 5: Attach userCount to each agent
    const agentsWithCount = agents.map((agent) => ({
      ...agent,
      userCount: userCountMap[agent._id.toString()] || 0,
    }));

    res.status(200).json({
      message: "All agents fetched successfully",
      data: agentsWithCount,
      // Optional: total users (if still needed)
      totalUsers: userCounts.reduce((sum, item) => sum + item.userCount, 0),
    });
  } catch (error) {
    console.error("Error fetching all agents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const AllBookedChits = async (req, res) => {
  try {
    const bookedChits = await BookedChit.find({ status: "active" })
      .populate({
        path: "userId",
        select: "name phone",
        populate: [
          { path: "agent", select: "name" },
          { path: "route", select: "place" },
        ],
      })
      .populate({
        path: "chitId",
        select: "totalDueAmount",
      })
      .populate({
        path: "auction",
        select: "payment",
      })
      .lean();

    res
      .status(200)
      .json({
        message: "All booked chits fetched successfully",
        data: bookedChits,
      });
  } catch (error) {
    console.error("Error fetching all booked chits:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const AllBookedChitsDue = async (req, res) => {
  try {
    const bookedChits = await BookedChit.find({ status: "active" })
      .populate({
        path: "chitId",
        select: "auctionTable groupCode",
      })
      .lean();

    if (!bookedChits || bookedChits.length === 0) {
      return res.status(404).json({ message: "No booked chits found" });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalDueAmount = 0;

    bookedChits.forEach((chit) => {
      if (chit.chitId && chit.chitId.auctionTable && chit.createdAt) {
        const createdAt = new Date(chit.createdAt); // Correctly use chit.createdAt
        const createdMonth = createdAt.getMonth();
        const createdYear = createdAt.getFullYear();

        // Calculate the number of months since the chit was created
        const monthsElapsed =
          (currentYear - createdYear) * 12 + (currentMonth - createdMonth) + 1;
        const dueAmount =
          chit.chitId.auctionTable[monthsElapsed - 1]?.dueAmount || 0;
        totalDueAmount += dueAmount;
      }
    });

    res.status(200).json({
      message: "Total due amount calculated successfully",
      totalDueAmount,
    });
  } catch (error) {
    console.error("Error fetching all booked chits count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const chithistory = async (req, res) => {
  try {
    const bookedChits = await BookedChit.find()
      .select("createdAt GroupUserId collectedAmount pendingAmount lastDate status")
      .populate([
        {
          path: "userId",
          select: "name phone",
          populate: { path: "agent", select: "name phone" },
        },
        { path: "chitId", select: "chitValue durationMonths" },
      ])
      .lean();

    res
      .status(200)
      .json({
        message: "Chit history fetched successfully",
        data: bookedChits,
      });
  } catch (error) {
    console.error("Error fetching chit history:", error); // Added error logging for debugging
    res.status(500).json({ message: "Internal server error" });
  }
};

const calculateMonthWiseDue = (chit, baseDate = new Date()) => {
  if (!chit?.chitId?.auctionTable || !chit?.createdAt) {
    return {
      currentMonth: 0,
      nextMonth: 0,
      nextNextMonth: 0,
    };
  }

  const createdAt = new Date(chit.createdAt);

  const createdMonth = createdAt.getMonth();
  const createdYear = createdAt.getFullYear();

  const baseMonth = baseDate.getMonth();
  const baseYear = baseDate.getFullYear();

  // current month index
  const currentMonthIndex =
    (baseYear - createdYear) * 12 + (baseMonth - createdMonth);

  const auctionTable = chit.chitId.auctionTable;

  return {
    currentMonth: auctionTable[currentMonthIndex]?.dueAmount || 0,
    nextMonth: auctionTable[currentMonthIndex + 1]?.dueAmount || 0,
    nextNextMonth: auctionTable[currentMonthIndex + 2]?.dueAmount || 0,
  };
};

export const AllBookedChitsDues = async (req, res) => {
  try {
    const bookedChits = await BookedChit.find({ status: "active" })
      .populate({
        path: "chitId",
        select: "auctionTable groupCode",
      })
      .lean();

    if (!bookedChits.length) {
      return res.status(404).json({ message: "No booked chits found" });
    }

    let summary = {
      currentMonth: 0,
      nextMonth: 0,
      nextNextMonth: 0,
    };

    bookedChits.forEach((chit) => {
      const due = calculateMonthWiseDue(chit);

      summary.currentMonth += due.currentMonth;
      summary.nextMonth += due.nextMonth;
      summary.nextNextMonth += due.nextNextMonth;
    });

    res.status(200).json({
      message: "Month-wise due calculated successfully",
      summary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const collectedAmount = async (req, res) => {
  try {
    const monthlyCollections = await MonthlyCollection.find({})
    const dailyCollections = await DailyCollection.find({})
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
}