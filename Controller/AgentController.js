import { signAccessToken, signRefreshToken, verifyToken } from "../utils/jwt.js";
import Agent from "../Model/AgentModal.js";
import bcrypt from "bcrypt";
import * as firebaseServices from '../firebaseServices.js';
import { Expo } from 'expo-server-sdk';
import User from "../Model/UserModel.js";

const expo = new Expo();


export const NewAgent = async (req, res) => {
  try {
    const agent = new Agent(req.body);
    if(!agent.name || !agent.phone || !agent.permanentAddress || !agent.dob){
      return res.status(400).json({ error: "All fields are required" });
    }
    if(!agent.phone.toString().match(/^[6-9]\d{9}$/)){
      return res.status(400).json({ error: "Invalid phone number" });
    }
    if(agent.phone){
      const existingAgent = await Agent.findOne({ phone: agent.phone });
      if (existingAgent) {
        return res.status(400).json({ error: "Phone number already exists" });
      }
    }
    
    await agent.save();
    res.status(200).json({ message: "Agent created successfully", agent });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const SetPin = async (req, res) => {
  try {
    const { agentId, phone } = req.body;
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    if (agent.phone !== phone) {
      return res.status(400).json({ message: "Phone number mismatch" });
    }

    const { pin } = req.body;
    if (!pin || pin.length < 6) {
      return res.status(400).json({ message: "PIN must be at least 6 characters long" });
    }
    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    if(agent.password === "000000"){
    agent.password = hashedPin;
    await agent.save();
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

    if (pin.length < 6) {
      return res.status(400).json({ message: "PIN must be at least 6 digits." });
    }

    const agent = await Agent.findById(userId);

    if (!agent) {
      return res.status(404).json({ message: "Agent not found." });
    }


    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    // Save the PIN and mark it as set
    agent.password = hashedPin;
    await agent.save();

    res.status(200).json({ message: "New PIN set successfully." });

  } catch (error) {
    console.error("Error setting PIN:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};



export const ForgetPin = async (req, res) => {
  try {
    const { agentId, phone, username } = req.body;
    const agent = await Agent.findOne({ agentId });
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    if (agent.phone !== phone) {
      return res.status(400).json({ message: "Phone number mismatch" });
    }
    if (agent.name !== username) {
      return res.status(400).json({ message: "Username mismatch" });
    }

    const { pin } = req.body;
    if (!pin || pin.length < 6) {
      return res.status(400).json({ message: "PIN must be at least 6 characters long" });
    }
    const salt = await bcrypt.genSalt(12);
    const hashedPin = await bcrypt.hash(pin, salt);

    if(agent.password !== "000000"){
      agent.password = hashedPin;
      await agent.save();
      res.status(200).json({ message: "PIN Reset successfully" });
    } else {
      res.status(400).json({ message: "Please set a new PIN" });
    }
  } catch (error) {
    console.error("Error setting PIN:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const LoginAgent = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone & password required" });
    }
    const agent = await Agent.findOne({ phone }).select("+password");
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    const isMatch = await bcrypt.compare(password, agent.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }
    const accessTokenAgent = signAccessToken(agent._id);
    const refreshTokenAgent = signRefreshToken(agent._id);
    res.status(200).json({
      success: true,
      agent: {
        id: agent._id,
        name: agent.name,
        phone: agent.phone,
      },
      accessTokenAgent,
      refreshTokenAgent,
    });
    res.status(200).json({ message: "Login successful", accessTokenAgent, refreshTokenAgent });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const RefreshTokenCon = async (req, res) => {
  try {
    const { refreshTokenAgent } = req.body;
    if (!refreshTokenAgent) {
      return res.status(400).json({ message: "Refresh token required" });
    }
    let decoded;
    try {
      decoded = verifyToken(refreshTokenAgent);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }
    const agent = await Agent.findById(decoded.id);
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    const accessTokenAgent = signAccessToken(agent._id);
    res.status(200).json({ accessTokenAgent });
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

    const agent = await Agent.updateOne(
      { _id: userId },
      { $set: { expoPushToken: token } }
    );
    if (agent.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    await firebaseServices.saveToken(userId, { expoPushToken: token });
    res.status(200).json({ success: true, message: 'Token saved' });
  } catch (error) {
    console.error('Error saving push token:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
    const agent = await Agent.findById(decoded.id)
      .populate("monthlyUsers");
    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }
    res.status(200).json({ agent });
  } catch (error) {
    console.log("Error fetching agent data:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


export const DailyChits = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findById(agentId)
      .populate({
        path: "route",
        populate: [
          {
            path: "DailyChit",
            populate: [
              { path: "chitId" },
              { path: "auction" },
              { 
                path: "userId", 
                select: "-password -expoPushToken"  // only for users
              }
            ]
          }
        ]
      })
      .select("-password -__v -createdAt -updatedAt -expoPushToken"); // for agent only

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.status(200).json({ message: "Daily chits fetched successfully", data: agent });
  } catch (error) {
    console.error("Error fetching daily chits:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



export const getallUsers = async (req, res) => {
  try {
    // Optionally, add query parameters to filter or limit fields
    const { fields, role } = req.query;

    // Build the query
    let query = User.find();

    // Apply role filter if provided
    if (role) {
      query = query.where("role").equals(role);
    }

    // Select fields dynamically or exclude sensitive ones
    const selectFields = fields ? fields.split(",").join(" ") : "-password -expoPushToken";

    const users = await query
      .select(selectFields)
      .populate({
        path: "chits",
        populate: { path: "chitId", select: "groupCode chitValue durationMonths monthlyContribution dailyContribution totalDueAmount totalDividend" },
      })
      .populate("agent", "name phone agentId")
      .populate("nominee", "name dob relation phone permanentAddress")
      .populate("route", "name")
      .populate({
        path: "chits",
        populate: { path: "auction" },
      })
      .lean(); // Convert to plain JavaScript object for better performance

    // Check if route.name is missing and handle it
    users.forEach(user => {
      if (user.route && !user.route.name) {
        user.route.name = "Unknown"; // Fallback value
      }
    }); 

    if (!users.length) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ message: "Users fetched successfully", data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      message: error.name === "CastError" ? "Invalid data provided" : "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const MonthlyChits = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await Agent.findById(agentId)
      .populate({
        path: "monthlyUsers",
        populate: [
          {
            path: "chitId",
            select: "groupCode chitValue durationMonths monthlyContribution dailyContribution totalDueAmount totalDividend"
          },
          {
            path: "auction"
          },
          {
            path: "userId",
            select: "-password -expoPushToken"
          }
        ]
      })
      .select("-password -__v -createdAt -updatedAt -expoPushToken"); // for agent only

    if (!agent) {
      return res.status(404).json({ message: "Agent not found" });
    }

    res.status(200).json({ message: "Daily chits fetched successfully", data: agent });
  } catch (error) {
    console.error("Error fetching daily chits:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};