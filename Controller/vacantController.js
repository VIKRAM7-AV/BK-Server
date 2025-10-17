import { BookedChit } from "../Model/BookedChit.js";
import VacantChit from "../Model/VacantChitModel.js";
import { ChitExit } from "../Model/EnquiryModal.js";
import Notification from "../Model/notification.js";
import { Expo } from 'expo-server-sdk';
import { model } from "mongoose";

export const VacantAdd = async (req, res) => {
    try {
        const { chitExit } = req.params;
        const { creater } = req.body;

        const chitRequest = await ChitExit.findOne({ bookedchit: chitExit });
        if (!chitRequest) {
            return res.status(404).json({ message: "Chit Exit request not found" });
        }

        

        const ExistingChit = await BookedChit.findOne({ _id: chitExit }).populate('userId');
        if(!ExistingChit) {
            return res.status(404).json({ message: "Booked Chit not found" });
        }

        if(ExistingChit) {
            await BookedChit.updateOne({ _id: chitExit }, { status: "closed" });
        }

        if(chitRequest) {
            await ChitExit.updateOne({ bookedchit: chitExit }, { status: "approved"});
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