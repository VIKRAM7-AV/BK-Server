import User from "../Model/UserModel.js";
import bcrypt from "bcrypt";
import * as firebaseServices from '../firebaseServices.js';
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";

export const SetPin = async (req, res) => {
  try {
    const { userId, phone } = req.body;
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.phone !== phone) {
      return res.status(400).json({ message: "Phone number mismatch" });
    }

    const { pin } = req.body;
    if (!pin || pin.length < 4) {
      return res.status(400).json({ message: "PIN must be at least 4 characters long" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    if(user.password === "0000"){      
    user.password = hashedPin;
    await user.save();
    res.status(200).json({ message: "PIN set successfully" });
    } else {
      res.status(400).json({ message: "Please Reset a your PIN" });
    }
  } catch (error) {
    console.error("Error setting PIN:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const ChangePin = async (req, res) => {
  try {
    const { pin , userId } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "PIN is required." });
    }

    if (pin.length < 4) {
      return res.status(400).json({ message: "PIN must be at least 4 digits." });
    }

    const user = await User.findById(userId);

    console.log(user, userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }


    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Save the PIN and mark it as set
    user.password = hashedPin;
    await user.save();

    res.status(200).json({ message: "New PIN set successfully." });

  } catch (error) {
    console.error("Error setting PIN:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



export const ForgetPin = async (req, res) => {
  try {
    const { userId, phone, username } = req.body;
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.phone !== phone) {
      return res.status(400).json({ message: "Phone number mismatch" });
    }
    if (user.name !== username) {
      return res.status(400).json({ message: "Username mismatch" });
    }

    const { pin } = req.body;
    if (!pin || pin.length < 4) {
      return res.status(400).json({ message: "PIN must be at least 4 characters long" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    if(user.password !== "0000"){
      user.password = hashedPin;
      await user.save();
      res.status(200).json({ message: "PIN Reset successfully" });
    } else {
      res.status(400).json({ message: "Please set a new PIN" });
    }
  } catch (error) {
    console.error("Error setting PIN:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const LoginCon = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone & password required" });
    }
    const user = await User.findOne({ phone }).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
      },
      accessToken,
      refreshToken,
    });
    res.status(200).json({ message: "Login successful", accessToken, refreshToken });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const RefreshTokenCon = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }
    let decoded;
    try {
      decoded = verifyToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const accessToken = signAccessToken(user._id);
    res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const TokenPush = async (req, res) => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      return res.status(400).json({ success: false, message: 'User ID and token required' });
    }

    const user = await User.updateOne(
      { _id: userId },
      { $set: { expoPushToken: token } }
    );
    if (user.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await firebaseServices.saveToken(userId, { expoPushToken: token });
    res.status(200).json({ success: true, message: 'Token saved' });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


export const NewUser = async (req, res) => {
  try {
    const {
      name,
      dob,
      phone,
      occupation,
      monthlyIncome,
      permanentAddress,
      occupationAddress,
      route,
      nominee,
    } = req.body;

    if (
      !name ||
      !dob ||
      !phone ||
      !occupation ||
      !monthlyIncome ||
      !permanentAddress ||
      !occupationAddress ||
      !route ||
      !nominee ||
      !nominee.name ||
      !nominee.dob ||
      !nominee.relation ||
      !nominee.permanentAddress ||
      !nominee.phone
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    const newUser = new User({
      name,
      dob,
      phone,
      occupation,
      monthlyIncome,
      permanentAddress,
      occupationAddress,
      route,
      nominee,
    });

    const savedUser = await newUser.save();
    res.status(200).json({
      message: "User created successfully",
      userId: savedUser.userId,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const LogoutCon = async (req, res) => {
  res.status(200).json({ message: "Logout successful. Please delete tokens on client." });
};


export const me = async (req, res) => {
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
    const user = await User.findById(decoded.id)
      .populate({
      path: "chits",
      populate: [
        { path: "chitId", model: "ChitGroup" },
        { path: "auction", model: "Auction" }
      ]
      })
      .populate({
      path: "auction",
      populate: [
        { path: "chitId", model: "ChitGroup" }
      ]
      });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch (error) {
    console.log("Error fetching user data:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};




