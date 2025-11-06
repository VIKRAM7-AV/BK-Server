import {BookedChit} from "../Model/BookedChit.js";
import Admin from "../Model/AdminModal.js";
import User from "../Model/UserModel.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/jwt.js";
import bcrypt from "bcryptjs";
import DailyCollection from "../Model/DailyCollectionModel.js";


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
        name: admin.name
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
    const dailychitusers = await BookedChit.find({ bookingType: "daily" }).populate({
      path: "userId",
      select: "-password -expoPushToken",
      populate: [
        {path: "auction"},
        { path: "agent", select: "name phone" },
        { path: "route", select: "place" }
      ]
    }).populate({
      path: "chitId",
      select: "chitValue"
    }).lean();

    res
      .status(200)
      .json({ message: "Daily chit users fetched successfully", data: dailychitusers });
    
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
}


export const getdailyChitusersReport = async (req, res) => {
  try {
    const dailyCollections = await DailyCollection.find({}).populate({
      path: "days.payments.bookedChit", 
      populate: { path: "userId" }  
    }).populate("routeId");
    
    if (!dailyCollections || dailyCollections.length === 0) {
      return res.status(404).json({ message: "Daily collections not found" });
    }

    res
      .status(200)
      .json({ message: "Daily chit users report fetched successfully", data: dailyCollections });
    
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
}