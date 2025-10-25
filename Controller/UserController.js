
import fs from 'fs';
import User from "../Model/UserModel.js";
import bcrypt from "bcrypt";
import * as firebaseServices from '../firebaseServices.js';
import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import { v2 as cloudinary } from 'cloudinary';
import { Expo } from 'expo-server-sdk';
import AgentNotification from '../Model/AgentNotification.js';
import {ExitCompany} from '../Model/EnquiryModal.js';
import Notification from "../Model/notification.js";


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

// export const NewUser = async (req, res) => {
//   try {
//     const {
//       profile,
//       name,
//       dob,
//       phone,
//       occupation,
//       monthlyIncome,
//       permanentAddress,
//       agent,
//       occupationAddress,
//       route,
//       nominee,
//     } = req.body;

//     if (
//       !profile ||
//       !name ||
//       !dob ||
//       !phone ||
//       !occupation ||
//       !monthlyIncome ||
//       !permanentAddress ||
//       !occupationAddress ||
//       !route ||
//       !agent ||
//       !nominee ||
//       !nominee.name ||
//       !nominee.dob ||
//       !nominee.relation ||
//       !nominee.permanentAddress ||
//       !nominee.phone
//     ) {
//       return res.status(400).json({ error: "All fields are required" });
//     }

//     const existingUser = await User.findOne({ phone });
//     if (existingUser) {
//       return res.status(400).json({ error: "Phone number already exists" });
//     }

//     const newUser = new User({
//       profile,
//       name,
//       dob,
//       phone,
//       occupation,
//       monthlyIncome,
//       permanentAddress,
//       occupationAddress,
//       agent,
//       route,
//       nominee,
//     });

//     const image = await cloudinary.uploader.upload(profile, {
//       folder: "user_profiles",
//       width: 500,
//       crop: "scale",
//     });
//     newUser.profile = image.secure_url;
//     const savedUser = await newUser.save();
//     res.status(200).json({
//       message: "User created successfully",
//       userId: savedUser.userId,
//     });
//   } catch (error) {
//     console.error("Error creating user:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };



export const NewUser = async (req, res) => {
  try {
    const normalized = {};
    for (const [rawKey, value] of Object.entries(req.body || {})) {
      if (rawKey.includes('[') && rawKey.includes(']')) {
        const parts = rawKey.replace(/\]/g, '').split('[');
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (i === parts.length - 1) {
            cur[p] = value;
          } else {
            cur[p] = cur[p] || {};
            cur = cur[p];
          }
        }
      } else {
        normalized[rawKey] = value;
      }
    }
    const body = normalized;

    // Accept profile from req.file (multer) or req.body.profile (URL)
    const uploadedProfile = req.file ?? (req.files && req.files.profile) ?? body.profile;

    // Destructure fields
    const {
      name,
      dob,
      phone: phoneStr,
      occupation,
      monthlyIncome: monthlyIncomeStr,
      permanentAddress,
      agent,
      occupationAddress,
      route,
      nominee: rawNominee = {},
    } = body;

    // Convert types to match model (numbers)
    const monthlyIncome = monthlyIncomeStr !== undefined ? parseFloat(monthlyIncomeStr) : NaN;
    const phone = phoneStr !== undefined ? Number(String(phoneStr).trim()) : NaN;
    const nomineePhone = rawNominee.phone !== undefined ? Number(String(rawNominee.phone).trim()) : NaN;

    const nominee = {
      name: rawNominee.name?.trim(),
      dob: rawNominee.dob,
      phone: nomineePhone,
      relation: rawNominee.relation?.trim(),
      permanentAddress: rawNominee.permanentAddress?.trim(),
    };

    // Validation
    const missing = [];
    if (!uploadedProfile) missing.push('profile');
    if (!name || !name.trim()) missing.push('name');
    if (!dob) missing.push('dob');
    if (!phone || Number.isNaN(phone)) missing.push('phone');
    if (!occupation || !occupation.trim()) missing.push('occupation');
    if (Number.isNaN(monthlyIncome)) missing.push('monthlyIncome');
    if (!permanentAddress || !permanentAddress.trim()) missing.push('permanentAddress');
    if (!occupationAddress || !occupationAddress.trim()) missing.push('occupationAddress');
    if (!route) missing.push('route');
    if (!agent) missing.push('agent');
    if (!nominee.name) missing.push('nominee.name');
    if (!nominee.dob) missing.push('nominee.dob');
    if (!nominee.relation) missing.push('nominee.relation');
    if (!nominee.permanentAddress) missing.push('nominee.permanentAddress');
    if (!nominee.phone || Number.isNaN(nominee.phone)) missing.push('nominee.phone');

    if (missing.length > 0) {
      return res.status(400).json({ error: 'Missing or invalid fields', missing });
    }

    // Normalize profile value: if it's a file object from multer, use .path or .filename else assume URL string
    let profileValue = null;
    if (typeof uploadedProfile === 'string') {
      profileValue = uploadedProfile;
    } else if (uploadedProfile && typeof uploadedProfile === 'object') {
      profileValue = uploadedProfile.path ?? uploadedProfile.filename ?? (Array.isArray(uploadedProfile) && uploadedProfile[0] && (uploadedProfile[0].path || uploadedProfile[0].filename)) ?? null;
    }

    // Check existing phone (phone stored as Number in your model)
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already exists' });
    }

    // Create user document matching your model
    const newUser = new User({
      profile: profileValue,
      name: name.trim(),
      dob,
      phone,
      occupation: occupation.trim(),
      monthlyIncome,
      permanentAddress: permanentAddress.trim(),
      agent,
      route,
      occupationAddress: occupationAddress.trim(),
      nominee,
    });

    const savedUser = await newUser.save();
    return res.status(200).json({
      message: 'User created successfully',
      userId: savedUser.userId ?? savedUser._id,
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
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
    return res.status(500).json({ message: "Internal server error" });
  }
};



export const approvedCompanyExit = async (req, res) => {
  try {
    const { id } = req.params;

    const existUser = await User.findOne({ _id: id, status: 'active' }).populate('agent');
    if (!existUser) {
      return res.status(404).json({ message: "User not found or already inactive" });
    }

    const exitRequest = await ExitCompany.findOne({ userId: id, status: 'pending' });
    if (!exitRequest) {
      return res.status(404).json({ message: "Pending exit request not found" });
    }

    existUser.status = 'inactive';
    existUser.password = '0000';
    await existUser.save();


    if (existUser.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: existUser.expoPushToken,
        sound: 'default',
        title: 'Company Exit Approved',
        body: `Your request to exit the company has been approved successfully.`,
      }];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      for (let chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          for (const ticket of ticketChunk) {
            if (ticket.id) {
              await Notification.create({
                userId: existUser._id,
                title: 'Company Exit Approved',
                body: `Your request to exit the company has been approved successfully.`,
                notificationId: ticket.id
              });
            } else if (ticket.status === "error") {
              console.error(`Push notification failed: ${ticket.message}`);
            }
          }
        } catch (error) {
          console.error('Error sending push notification:', error);
        }
      }
    }

    const agentNotification = new AgentNotification({
      agentId: existUser.agent._id,
      title: 'User Company Exit Approved',
      description: `User ${existUser.name} has successfully exited the company.`
    });
    await agentNotification.save();
   
    // Delete the exit request document
    await ExitCompany.deleteOne({ _id: exitRequest._id });

    res.status(200).json({ message: "Company exit approved successfully" });
    
  } catch (error) {
    console.error("Error approving company exit:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
}


export const rejectCompanyExit = async (req, res) => {
  try {
    const { id } = req.params;

    const existUser = await User.findOne({ _id: id, status: 'active' }).populate('agent');
    if (!existUser) {
      return res.status(404).json({ message: "User not found or already inactive" });
    }

    const exitRequest = await ExitCompany.findOne({ userId: id, status: 'pending' });
    if (!exitRequest) {
      return res.status(404).json({ message: "Pending exit request not found" });
    }

    if (existUser.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: existUser.expoPushToken,
        sound: 'default',
        title: 'Company Exit Rejected',
        body: `Your request to exit the company has been rejected.`,
      }];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      for (let chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          for (const ticket of ticketChunk) {
            if (ticket.id) {
              await Notification.create({
                userId: existUser._id,
                title: 'Company Exit Rejected',
                body: `Your request to exit the company has been rejected.`,
                notificationId: ticket.id
              });
            } else if (ticket.status === "error") {
              console.error(`Push notification failed: ${ticket.message}`);
            }
          }
        } catch (error) {
          console.error('Error sending push notification:', error);
        }
      }
    }

    const agentNotification = new AgentNotification({
      agentId: existUser.agent._id,
      title: 'User Company Exit Rejected',
      description: `User ${existUser.name}'s exit request has been rejected.`
    });
    await agentNotification.save();

    // Delete the exit request document
    await ExitCompany.deleteOne({ _id: exitRequest._id });

    res.status(200).json({ message: "Company exit rejected successfully" });
    
  } catch (error) {
    console.error("Error rejecting company exit:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
}