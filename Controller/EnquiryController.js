import mongoose from 'mongoose';
import { Enquiry, ChitExit, ExitCompany, OpenChit} from '../Model/EnquiryModal.js';
import Agent from "../Model/AgentModal.js"
import {BookedChit} from "../Model/BookedChit.js";
import WorkerRoute from '../Model/WorkerRoute.js';
import User from "../Model/UserModel.js";
import { Expo } from 'expo-server-sdk'; 
import VacantChit from '../Model/VacantChitModel.js';
import AgentNotification from '../Model/AgentNotification.js';
import { UserAuctionData } from '../Model/auctionModel.js';


const sendEnquiryNotification = async (agent, enquiryData) => {
  const { name, chitPlan, duration } = enquiryData;
  const title = 'New Enquiry Assigned';
  const body = `New enquiry from ${name} for ₹${chitPlan} chit plan (${duration} months)`;
  
  // Expo push notification only
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
  
  return {
    title: 'New Enquiry Assigned',
    description: `New enquiry from ${name} for ₹${chitPlan} chit plan (${duration} months)`
  };
};

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
    
    const agents = await Agent.find({});
    if (agents.length === 0) {
      return res.status(500).json({ success: false, message: 'No agents available' });
    }
    
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
    
    const notificationData = await sendEnquiryNotification(lowestAgent, { name, chitPlan, duration });
    
    const newEnquiry = new Enquiry({
      name,
      phone,
      chitPlan,
      duration,
      message,
      title: notificationData.title,
      description: notificationData.description,
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
    return null;
  }

  const userName = bookedChitDoc.userId.name;
  const chitGroupID = bookedChitDoc.chitId.groupCode;

  const title = 'Chit Exit Processed';
  const body = `A chit exit has been processed for ${userName}'s chit group ${chitGroupID}`;

  // Expo push notification only
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

  // Return title and description for ChitExit model
  return {
    title: 'Chit Exit Processed',
    description: `A chit exit has been processed for ${userName}'s chit group ${chitGroupID}`
  };
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

    // Send notification and get title/description
    const notificationData = await sendChitExitNotification(existAgent, bookedchit);

    // Create and save exit with title and description
    const newChitExit = new ChitExit({
      agentId: existAgent._id,
      bookedchit,
      title: notificationData?.title || 'Chit Exit Processed',
      description: notificationData?.description || `Chit exit processed for booked chit ID: ${bookedchit}`
    });
    await newChitExit.save();

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
    return null;
  }

  const userName = user.name;

  const title = 'Company Exit Processed';
  const body = `A company exit has been processed for ${userName}`;

  // Expo push notification only
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

  // Return title and description for ExitCompany model
  return {
    title: 'Company Exit Processed',
    description: `A company exit has been processed for ${userName}`
  };
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

    // Send notification and get title/description
    const notificationData = await sendCompanyExitNotification(existAgent, userId);

    // Create and save exit with title and description
    const newCompanyExit = new ExitCompany({
      agentId: existAgent._id,
      userId,
      title: notificationData?.title || 'Company Exit Processed',
      description: notificationData?.description || `A company exit has been processed for user ID: ${userId}`
    });
    await newCompanyExit.save();

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
    return null;
  }

  const vacantChit = await VacantChit.findOne({ _id: vacantChitId })
    .select('chitplan pendingAmount collectedAmount')
    .populate({ path: 'chitplan', model: 'ChitGroup' });

  if (!vacantChit) {
    return null;
  }

  const userName = user.name;
  const groupCode = vacantChit.chitplan?.groupCode || 'N/A';
  const pendingAmount = vacantChit.pendingAmount + vacantChit.collectedAmount || 0;

  const title = `New Vacant Chit Booking for ${userName}`;
  const body = `Your client ${userName} has newly sent a request for vacant chit. Group Code: ${groupCode}, Balance Due: ${pendingAmount}`;

  // Expo push notification only
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

  // Return title and description for OpenChit model
  return {
    title: `New Vacant Chit Booking for ${userName}`,
    description: `Your client ${userName} has newly sent a request for vacant chit. Group Code: ${groupCode}, Balance Due: ${pendingAmount}`
  };
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

    // Send notification and get title/description
    const notificationData = await sendVacantChitNotification(existAgent, userId, openchit);

    // Create and save new booking with title and description
    const newOpenChit = new OpenChit({
      agentId: existAgent._id,
      openchit: openchit,
      userId,
      title: notificationData?.title || 'New Vacant Chit Booking',
      description: notificationData?.description || `Vacant chit booking request for chit ID: ${openchit}`
    });
    await newOpenChit.save();

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


// Express route handler function
export const getAgentNotifications = async (req, res) => {
  try {
    const { agentId } = req.params;

    // Validate agentId (assuming it's a valid ObjectId)
    if (!mongoose.Types.ObjectId.isValid(agentId)) {
      return res.status(400).json({ error: 'Invalid agentId' });
    }

    // Fetch data from each model filtered by agentId (using .lean() for plain objects)
    const enquiries = await Enquiry.find({ agentId, status: 'pending' }).sort({ createdAt: -1 }).lean();
    const chitExits = await ChitExit.find({ agentId })
      .sort({ createdAt: -1 })
      .populate({
        path: 'bookedchit',
        populate: [
          { path: 'userId', select: 'name profile phone' },
          { path: 'chitId', select: 'groupCode' }
        ]
      })
      .lean();
    const exitCompanies = await ExitCompany.find({ agentId })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: '-password -expoPushToken' })
      .lean();
    const openChits = await OpenChit.find({ agentId })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: '-password -expoPushToken' })
      .populate({
        path: 'openchit',
        populate: [
          {
            path: 'creater',
            select: 'name profile'
          },
          {
            path: 'chitplan',
            model: 'ChitGroup',
            select: 'groupCode'
          }
        ]
      })
      .lean();

      const UserAuction = await UserAuctionData.find({ agentId })
      .sort({ createdAt: -1 })
      .populate({ path: 'userId', select: '-password -expoPushToken' })
      .populate({
        path: 'auctionId',
        select: 'createdAt',
        populate: {
          path: 'chitId',
          select: 'groupCode',
        },        
      })
      .lean();
          
      // Combine all notifications into a single mixed array with type
    const notifications = [
      ...enquiries.map(item => ({ ...item, type: 'Enquiry' })),
      ...chitExits.map(item => ({ ...item, type: 'ChitExit' })),
      ...exitCompanies.map(item => ({ ...item, type: 'ExitCompany' })),
      ...openChits.map(item => ({ ...item, type: 'OpenChit' })),
      ...UserAuction.map(item => ({ ...item, type: 'UserAuctionData' }))
    ];

    // Sort the combined notifications by createdAt descending (mixed order)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      data: notifications, // Single mixed sorted list
      counts: {
        enquiries: enquiries.length,
        chitExits: chitExits.length,
        exitCompanies: exitCompanies.length,
        openChits: openChits.length,
        UserAuction: UserAuction.length
      }
    });
  } catch (error) {
    console.error('Error fetching agent notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};



export const markNotificationAsViewed = async (req, res) => {
  try {
    const { id, type } = req.body;

    // Validate required fields
    if (!id || !type) {
      return res.status(400).json({ error: 'id and type are required' });
    }

    // Validate id format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid id format' });
    }

    let updatedNotification;
    let Model;

    // Select the appropriate model based on type
    switch (type) {
      case 'Enquiry':
        Model = Enquiry;
        break;
      case 'ChitExit':
        Model = ChitExit;
        break;
      case 'ExitCompany':
        Model = ExitCompany;
        break;
      case 'OpenChit':
        Model = OpenChit;
        break;
      case 'UserAuctionData':
        Model = UserAuctionData;
        break;
      default:
        return res.status(400).json({ error: 'Invalid notification type' });
    }

    // Update the viewed status
    updatedNotification = await Model.findByIdAndUpdate(
      id,
      { view: true },
      { new: true } // Return the updated document
    );

    // Check if notification exists
    if (!updatedNotification) {
      return res.status(404).json({ error: `${type} notification not found` });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as viewed',
      data: updatedNotification
    });
  } catch (error) {
    console.error('Error marking notification as viewed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};




export const completeEnquiry = async (req, res) => {
  try {
    const { id } = req.params; 

    const enquiry = await Enquiry.findOne({ _id: id, status: 'pending' });
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found or already completed" });
    }

    enquiry.status = 'completed';
    await enquiry.save();

    const agentNotification = new AgentNotification({
      agentId: enquiry.agentId,
      title: 'Enquiry Completed',
      description: `Enquiry from ${enquiry.name} has been completed.`
    });
    await agentNotification.save();

    res.status(200).json({ message: "Enquiry completed successfully" });
    
  } catch (error) {
    console.error("Error completing enquiry:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
};