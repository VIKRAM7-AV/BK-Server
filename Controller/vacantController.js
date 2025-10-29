import { Auction, BookedChit } from "../Model/BookedChit.js";
import VacantChit from "../Model/VacantChitModel.js";
import { ChitExit, OpenChit } from "../Model/EnquiryModal.js";
import Notification from "../Model/notification.js";
import { Expo } from 'expo-server-sdk';
import AgentNotification from "../Model/AgentNotification.js";
import User from "../Model/UserModel.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";

export const VacantAdd = async (req, res) => {
    try {
        const { chitExit } = req.params;
        const { creater } = req.body;

        const chitRequest = await ChitExit.findOne({ _id: chitExit });
        if (!chitRequest) {
            return res.status(404).json({ message: "Chit Exit request not found" });
        }

        const bookedchit = chitRequest.bookedchit;

        const ExistingChit = await BookedChit.findOne({ _id: bookedchit }).populate('userId');
        if(!ExistingChit) {
            return res.status(404).json({ message: "Booked Chit not found" });
        }

        if(ExistingChit) {
            await BookedChit.updateOne({ _id: bookedchit }, { status: "closed" });
        }

        if(chitRequest) {
            await ChitExit.updateOne({ bookedchit: bookedchit }, { status: "approved"});
        }

        const startDate = new Date(ExistingChit.createdAt);
        const endDate = new Date();
        const monthIndex = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());

        const newVacantChit = new VacantChit({
            creater,
            chitplan: ExistingChit.chitId,
            duration: monthIndex,
            collectedAmount: ExistingChit.collectedAmount,
            pendingAmount: ExistingChit.pendingAmount
        });

        await newVacantChit.save();

        // Send push notification
        if (ExistingChit.userId && ExistingChit.userId.expoPushToken) {
            const expo = new Expo();
            const messages = [{
                to: ExistingChit.userId.expoPushToken,
                sound: 'default',
                title: 'Chit Group Exit Successful',
                body: `You have successfully exited the chit group ${ExistingChit.GroupUserId}.`,
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
                                    userId: ExistingChit.userId._id,
                                    title: 'Chit Group Exit Successful',
                                    body: `You have successfully exited the chit group ${ExistingChit.GroupUserId}.`,
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

        res.status(200).json({ message: "Vacant Chit added successfully", data: newVacantChit });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
        console.error("Error adding vacant chit:", error);        
    }
}



export const VacantList = async (req, res) => {
    try {
        const vacantChits = await VacantChit.find({status: "active"}).populate({
            path: 'creater',
            select: '-password -expoPushToken'
        }).populate({ path: 'chitplan', model: 'ChitGroup' });
        res.status(200).json({ message: "Vacant Chits fetched successfully", data: vacantChits });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
}



export const rejectNewVacantChit = async (req, res) => {
  try {
    const { id } = req.params; // notification id
    
    // Find the pending open chit notification
    const openChitNotification = await OpenChit.findOne({ _id: id });
    if (!openChitNotification) {
      return res.status(404).json({ message: "Pending vacant chit request not found" });
    }

    // Get the user details and populate agent
    const user = await User.findById(openChitNotification.userId).populate('agent');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send push notification to user if they have expo push token
    if (user.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: user.expoPushToken,
        sound: 'default',
        title: 'Vacant Chit Request Rejected',
        body: `Your request for the vacant chit has been rejected.`,
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
                userId: user._id,
                title: 'Vacant Chit Request Rejected',
                body: `Your request for the vacant chit has been rejected.`,
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

    // Save agent notification
    const agentNotification = new AgentNotification({
      agentId: user.agent._id,
      title: 'Vacant Chit Request Rejected',
      description: `User ${user.name}'s vacant chit request has been rejected.`
    });
    await agentNotification.save();

    // Delete the open chit notification
    await OpenChit.deleteOne({ _id: openChitNotification._id });

    res.status(200).json({ message: "Vacant chit request rejected successfully" });
    
  } catch (error) {
    console.error("Error rejecting vacant chit request:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
};


export const approveVacantChit = async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingType } = req.body;

    if (!bookingType || !['daily', 'monthly'].includes(bookingType)) {
      return res.status(400).json({ message: "Valid booking type is required (daily/monthly)" });
    }

    // Find the pending open chit notification
    const openChitNotification = await OpenChit.findOne({ _id: id });
    if (!openChitNotification) {
      return res.status(404).json({ message: "Pending vacant chit request not found" });
    }

    // Get the user details and populate agent
    const user = await User.findById(openChitNotification.userId).populate('agent');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const vacantChit = await VacantChit.findOne({ _id: openChitNotification.openchit }).populate({
      path: 'chitplan', model: 'ChitGroup'
    });
    if (!vacantChit) {
      return res.status(404).json({ message: "Vacant chit not found" });
    }

    // Validate route/agent based on booking type
    let CurrectRoute, Bookagent;
    if (bookingType === "daily") {
      const route = await User.findOne({ _id: user._id }).select("route");
      if (!route || !route.route) {
        return res.status(400).json({
          message: "User route information is missing. Please update your profile with route details before booking a daily chit."
        });
      }
      CurrectRoute = await WorkerRoute.findOne({ _id: route.route });
      if (!CurrectRoute) {
        return res.status(400).json({
          message: "No worker route found for the user's route. Please contact support."
        });
      }
    }

    if (bookingType === "monthly") {
      if (!user.agent) {
        return res.status(400).json({
          message: "User agent information is missing. Please update your profile with agent details before booking a monthly chit."
        });
      }
      Bookagent = await Agent.findOne({ _id: user.agent._id });
      if (!Bookagent) {
        return res.status(400).json({
          message: "No agent found for the user's agent. Please contact support."
        });
      }
    }

    // Create auction record
    const auction = new Auction({
      chitId: vacantChit.chitplan._id,
      userId: user._id,
      payment: 0,
      status: "pending"
    });
    await auction.save();

    // Calculate GroupUserId for vacant chit
    const chitPlan = vacantChit.chitplan;
    const branchCode = "001";
    const groupCode = chitPlan.groupCode;

    const existingBookings = await BookedChit.countDocuments({
      GroupUserId: new RegExp(`^${groupCode}/${branchCode}/`)
    });
    const memberNumber = existingBookings + 1;
    const groupUserId = `${groupCode}/${branchCode}/${memberNumber}`;

    // Check if GroupUserId already exists
    const existingBooking = await BookedChit.findOne({ groupUserId });
    if (existingBooking) {
      return res.status(400).json({ error: "GroupUserId already exists" });
    }

    // Calculate dates for vacant chit
    // Duration is in months, calculate start date by going back (today - duration months)
    const today = new Date();
    const createdAtDate = new Date(today.getFullYear(), today.getMonth() - vacantChit.duration, today.getDate());

    const PendingAmountCalculate = vacantChit.collectedAmount + vacantChit.pendingAmount;

    // Create booked chit for vacant chit
    const bookedChit = new BookedChit({
      chitId: vacantChit.chitplan._id,
      userId: user._id,
      GroupUserId: groupUserId,
      bookingType,
      monthlyAmount: chitPlan.monthlyContribution,
      dailyAmount: chitPlan.dailyContribution,
      auction: auction._id,
      collectedAmount: 0,
      pendingAmount: PendingAmountCalculate,
      status: "active",
      month: new Date(),
      createdAt: createdAtDate
    });
    await bookedChit.save();

    // Add booked chit to user
    user.chits.push(bookedChit._id);
    if (bookingType === "daily" && CurrectRoute) {
      CurrectRoute.DailyChit.push(bookedChit._id);
      await CurrectRoute.save();
    }

    if (bookingType === "monthly" && Bookagent) {
      Bookagent.monthlyUsers.push(bookedChit._id);
      await Bookagent.save();
    }

    user.auction.push(auction._id);
    await user.save();

    // Update vacant chit status to 'booked'
    vacantChit.status = 'booked';
    await vacantChit.save();

    // Send push notification to user if they have expo push token
    if (user.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: user.expoPushToken,
        sound: 'default',
        title: 'Vacant Chit Request Approved',
        body: `Your vacant chit request has been approved and booked successfully.`
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
                userId: user._id,
                title: 'Vacant Chit Request Approved',
                body: `Your vacant chit request has been approved and booked successfully.`,
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

    // Save agent notification
    const agentNotification = new AgentNotification({
      agentId: user.agent._id,
      title: 'Vacant Chit Request Approved',
      description: `User ${user.name}'s vacant chit request has been approved and booked.`
    });
    await agentNotification.save();

    // Delete the open chit notification
    await OpenChit.deleteOne({ _id: openChitNotification._id });

    res.status(200).json({ 
      message: "Vacant chit request approved successfully",
      bookedChit,
      groupUserId
    });

  } catch (error) {
    console.error("Error approving vacant chit request:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};