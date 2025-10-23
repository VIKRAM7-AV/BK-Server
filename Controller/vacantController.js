import { BookedChit } from "../Model/BookedChit.js";
import VacantChit from "../Model/VacantChitModel.js";
import { ChitExit, OpenChit } from "../Model/EnquiryModal.js";
import Notification from "../Model/notification.js";
import { Expo } from 'expo-server-sdk';
import AgentNotification from "../Model/AgentNotification.js";
import User from "../Model/UserModel.js";

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


