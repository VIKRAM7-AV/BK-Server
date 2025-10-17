import { Enquiry, ChitExit, ExitCompany, OpenChit} from '../Model/EnquiryModal.js';
import Agent from "../Model/AgentModal.js"
import {BookedChit} from "../Model/BookedChit.js";
import WorkerRoute from '../Model/WorkerRoute.js';
import User from "../Model/UserModel.js";
import { Expo } from 'expo-server-sdk'; 
import VacantChit from '../Model/VacantChitModel.js';


export const NewEnquiry = async (req, res) => {
  try {
    const { name, phone, chitPlan, duration, message } = req.body;

    if (!name || !phone || !chitPlan || !duration) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid phone number format' });
    }

    const phoneExists = await Enquiry.findOne({ phone });
    if (phoneExists) {
      return res.status(200).json({ success: false, message: 'Your Phone number already Exists' });
    }

    // Step 1: Get all agents
    const agents = await Agent.find({});
    if (agents.length === 0) {
      return res.status(500).json({ success: false, message: 'No agents available' });
    }

    // Step 2: Calculate total chit value per agent
    let lowestAgent = null;
    let lowestChitSum = Infinity;

    for (let agent of agents) {
      const enquiries = await Enquiry.find({ agentId: agent._id });
      const chitSum = enquiries.reduce((sum, eq) => sum + eq.chitPlan, 0);
      if (chitSum < lowestChitSum) {
        lowestChitSum = chitSum;
        lowestAgent = agent;
      }
    }

    // Step 3: Assign enquiry to agent with lowest total chit value
    const newEnquiry = new Enquiry({
      name,
      phone,
      chitPlan,
      duration,
      message,
      agentId: lowestAgent._id
    });

    await newEnquiry.save();

    res.status(200).json({ 
      success: true, 
      message: `Your enquiry has been submitted and assigned to ${lowestAgent.name}`, 
      data: newEnquiry 
    });

  } catch (error) {
    console.error('Error creating enquiry:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



const sendChitExitNotification = async (agent, bookedchit) => {
  const bookedChitDoc = await BookedChit.findOne({ _id: bookedchit })
    .populate({
      path: 'userId',
      select: 'name'
    })
    .populate({
      path: 'chitId',
      select: 'groupCode'
    });

  if (!bookedChitDoc || !bookedChitDoc.userId || !bookedChitDoc.chitId) {
    return;
  }

  const userName = bookedChitDoc.userId.name;
  const chitGroupID = bookedChitDoc.chitId.groupCode;

  const title = 'Chit Exit Processed';
  const body = `A chit exit has been processed for ${userName}'s chit group ${chitGroupID}`;

  // Expo push
  if (agent?.expoPushToken) {
    const expo = new Expo();
    const messages = [{
      to: agent.expoPushToken,
      sound: 'default',
      title,
      body,
    }];

    // Manually chunk into groups of 100 (Expo limit)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
  }

  // In-app notification
  if (!agent.notification) {
    agent.notification = [];
  }
  agent.notification.push({
    type: 'chitExit',
    message: `A chit exit has been processed for ${userName}'s chit group ${chitGroupID}`,
  });
  await agent.save();
};


export const ChitExitFn = async (req, res) => {
  try {
    const { agentId, bookedchit, routeId } = req.body;

    // Basic input validation
    if (!bookedchit) {
      return res.status(400).json({ success: false, message: 'Booked chit is required' });
    }

    const existBookedChit = await BookedChit.findOne({ _id: bookedchit });
    if (!existBookedChit) {
      return res.status(400).json({ success: false, message: 'This Chit Does Not Exist' });
    }

    // Check for existing exit
    const existingExit = await ChitExit.findOne({ bookedchit });
    if (existingExit) {
      return res.status(400).json({ success: false, message: 'Chit exit already processed' });
    }

    let existAgent;
    if (existBookedChit.bookingType === 'daily') {
      if (!routeId) {
        return res.status(400).json({ success: false, message: 'Route ID is required for daily chits' });
      }

      const existRoute = await WorkerRoute.findOne({ _id: routeId });
      if (!existRoute) {
        return res.status(400).json({ success: false, message: 'This Route Does Not Exist' });
      }

      const RouteAgent = await Agent.findOne({route: routeId});
      const agent = RouteAgent?._id;
      if (!agent) {
        return res.status(400).json({ success: false, message: 'No agent assigned to this route' });
      }

      existAgent = await Agent.findOne({_id: agent});
    } else {
      if (!agentId) {
        return res.status(400).json({ success: false, message: 'Agent ID is required for non-daily chits' });
      }

      existAgent = await Agent.findOne({_id: agentId});
    }

    if (!existAgent) {
      return res.status(400).json({ success: false, message: 'Agent not found' });
    }

    // Create and save exit
    const newChitExit = new ChitExit({
      agentId: existAgent._id,
      bookedchit,
    });
    await newChitExit.save();

    // Send notifications

    await sendChitExitNotification(existAgent, bookedchit);

    const message = existBookedChit.bookingType === 'daily'
      ? 'Daily Chit exit processed successfully'
      : 'Monthly/Weekly Chit exit processed successfully';

    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error('Error processing chit exit:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};



const sendCompanyExitNotification = async (agent, userId) => {
  const user = await User.findOne({ _id: userId })
    .select('name');

  if (!user) {
    return;
  }

  const userName = user.name;

  const title = 'Company Exit Processed';
  const body = `A company exit has been processed for ${userName}`;

  // Expo push
  if (agent?.expoPushToken) {
    const expo = new Expo();
    const messages = [{
      to: agent.expoPushToken,
      sound: 'default',
      title,
      body,
    }];

    // Manually chunk into groups of 100 (Expo limit)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
  }

  // In-app notification
  if (!agent.notification) {
    agent.notification = [];
  }
  agent.notification.push({
    type: 'companyExit',
    message: `A company exit has been processed for ${userName}`,
  });
  await agent.save();
};

export const CompanyExitFn = async (req, res) => {
  try {
    const { userId } = req.body;

    // Basic input validation
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    // Verify user exists
    const existUser = await User.findOne({ _id: userId });
    if (!existUser) {
      return res.status(400).json({ success: false, message: 'This User Does Not Exist' });
    }

    const agentId = existUser?.agent;

    // Verify agent exists
    const existAgent = await Agent.findOne({ _id: agentId });
    if (!existAgent) {
      return res.status(400).json({ success: false, message: 'This Agent Does Not Exist' });
    }

    // Check for existing exit
    const existingExit = await ExitCompany.findOne({ userId });
    if (existingExit) {
      return res.status(400).json({ success: false, message: 'Company exit already processed for this user' });
    }

    // Create and save exit
    const newCompanyExit = new ExitCompany({
      agentId: existAgent._id,
      userId,
    });
    await newCompanyExit.save();

    // Send notifications
    await sendCompanyExitNotification(existAgent, userId);

    res.status(200).json({ 
      success: true, 
      message: 'Chit user Company exit processed successfully' 
    });
  } catch (error) {
    console.error('Error processing company exit:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};




const sendVacantChitNotification = async (agent, userId, vacantChitId) => {
  const user = await User.findOne({ _id: userId })
    .select('name');

  if (!user) {
    return;
  }

  const vacantChit = await VacantChit.findOne({ _id: vacantChitId })
    .select('chitplan  pendingAmount collectedAmount')
    .populate({ path: 'chitplan', model: 'ChitGroup' });

  if (!vacantChit) {
    return;
  }

  const userName = user.name;
  const groupCode = vacantChit.chitplan?.groupCode || 'N/A';
  const pendingAmount = vacantChit.pendingAmount + vacantChit.collectedAmount || 0;

  const title = `New Vacant Chit Booking for ${userName}`;
  const body = `Your client ${userName} has newly sent a request for vacant chit. Group Code: ${groupCode}, Balance Due: ${pendingAmount}`;

  // Expo push notification
  if (agent?.expoPushToken) {
    const expo = new Expo();
    const messages = [{
      to: agent.expoPushToken,
      sound: 'default',
      title,
      body,
    }];

    // Manually chunk into groups of 100 (Expo limit)
    const chunks = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }
  }

  // In-app notification
  if (!agent.notification) {
    agent.notification = [];
  }
  agent.notification.push({
    type: 'vacantChitBooking',
    message: `Your client ${userName} has newly sent a request for vacant chit. Group Code: ${groupCode}, Balance Due: ${pendingAmount}`,
  });
  await agent.save();
};

export const VacantChitBookingFn = async (req, res) => {
  try {
    const { openchit } = req.params;
    const { userId, agentId } = req.body;

    // Basic input validation
    if (!openchit || !userId || !agentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Open chit ID, User ID, and Agent ID are required' 
      });
    }

    // Verify user exists
    const existUser = await User.findOne({ _id: userId });
    if (!existUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'This User Does Not Exist' 
      });
    }

    // Verify agent exists
    const existAgent = await Agent.findOne({ _id: agentId });
    if (!existAgent) {
      return res.status(400).json({ 
        success: false, 
        message: 'This Agent Does Not Exist' 
      });
    }

    // Verify vacant chit exists
    const existVacantChit = await VacantChit.findOne({ _id: openchit, status: 'active' });
    if (!existVacantChit) {
      return res.status(400).json({ 
        success: false, 
        message: 'This Vacant Chit Does Not Exist' 
      });
    }

    // Check for existing booking
    const existingBooking = await OpenChit.findOne({ 
      openchit: openchit, 
      userId 
    });
    if (existingBooking) {
      return res.status(400).json({ 
        success: false, 
        message: 'This vacant chit is already booked by this user' 
      });
    }

    // Create and save new booking
    const newOpenChit = new OpenChit({
      agentId: existAgent._id,
      openchit: openchit,
      userId
    });
    await newOpenChit.save();

    // Send notifications
    await sendVacantChitNotification(existAgent, userId, openchit);

    res.status(200).json({ 
      success: true, 
      message: 'Vacant chit booking request sent successfully',
      data: newOpenChit
    });
  } catch (error) {
    console.error('Error processing vacant chit booking:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

