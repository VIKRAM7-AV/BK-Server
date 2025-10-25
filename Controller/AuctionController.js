import {AuctionData, UserAuctionData} from "../Model/auctionModel.js";
import { Auction, BookedChit } from "../Model/BookedChit.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";
import { Expo } from 'expo-server-sdk';
import Notification from "../Model/notification.js";
import ChitGroup from "../Model/ChitGroup.js";

export const setauction = async (req, res) => {
    try {
        const { auctionId } = req.params;
        const { agentId, date, reason, month } = req.body;

        if (!agentId || !date || !month) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existingData = await AuctionData.findOne({ auctionId: auctionId });
        if (existingData) {
            return res.status(400).json({ message: "Auction data already exists for this agent on the given date" });
        }

        const existingAuction = await Auction.findOne({ _id: auctionId });
        if (!existingAuction) {
            return res.status(400).json({ message: "Auction data does not exist for this auction" });
        }

        const bookedChit = await BookedChit.findOne({ auction: auctionId }).populate('userId').populate('chitId');
        if (!bookedChit) {
            return res.status(400).json({ message: "No booked chit found for this user" });
        }

        const userId = bookedChit.userId._id;
        const auctionTable = bookedChit.chitId.auctionTable;
        const monthEntry = auctionTable.find(entry => entry.month === parseInt(month));
        if (!monthEntry) {
            return res.status(400).json({ message: "Invalid month for this chit" });
        }
        const amount = monthEntry.payment;

        const auctionData = new AuctionData({
            auctionId,
            agentId,
            userId: userId,
            date,
            amount,
            reason
        });

        await auctionData.save();
        res.status(200).json({ message: "Auction data set successfully", auctionData });
    } catch (error) {
        res.status(500).json({ message: "Error setting auction data", error });
    }
};


export const ModifyUserAuctionDate = async (req, res) => {
    try {
        const { auctionId } = req.params;
        const { month, reason } = req.body;

        if (!month) {
            return res.status(400).json({ message: "Month is required" });
        }

        const existingAuctionData = await UserAuctionData.findOne({ auctionId: auctionId });
        if (existingAuctionData) {
            return res.status(404).json({ message: "You have already participated in this auction" });
        }

        const existingAuction = await Auction.findById(auctionId).populate('userId').populate('chitId');
        if (!existingAuction) {
            return res.status(404).json({ message: "No auction data found for this user" });
        }

        const bookedChit = await BookedChit.findOne({ auction: auctionId }).populate('userId');
        if (!bookedChit) {
            return res.status(400).json({ message: "No booked chit found for this auction" });
        }

        const userId = bookedChit.userId._id;
        const chitId = existingAuction.chitId._id;
        const chitGroup = await ChitGroup.findById(chitId);
        if (!chitGroup) {
            return res.status(400).json({ message: "Chit group not found" });
        }

        const auctionTable = chitGroup.auctionTable;
        const monthEntry = auctionTable.find(entry => entry.month === parseInt(month));
        if (!monthEntry) {
            return res.status(400).json({ message: "Invalid month for this chit" });
        }
        const amount = monthEntry.payment;

        let agentId;
        if (bookedChit.bookingType === 'monthly') {
            agentId = bookedChit.userId.agent;
        } else {
            const userRoute = await Agent.findOne({ route: bookedChit.userId.route });
            if (!userRoute) {
                return res.status(400).json({ message: "No agent found for the user's route" });
            }
            agentId = userRoute._id;
        }

        const date = existingAuction.auctionDate || new Date(); // Use auction date if available, else current

        const userAuctionData = new UserAuctionData({
            agentId,
            userId,
            auctionId,
            reason,
            date,
            amount
        });

        await userAuctionData.save();

        // Send push notification to agent
        const agent = await Agent.findById(agentId).populate('expoPushToken');
        if (agent && agent.expoPushToken) {
            const expo = new Expo();
            const messages = [{
                to: agent.expoPushToken,
                sound: 'default',
                title: 'New User Auction Participation',
                body: `User ${bookedChit.userId.name} has participated in auction for month ${month}.`,
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
                                userId: userId,
                                title: 'New Auction Participation',
                                body: `User ${bookedChit.GroupUserId} has participated in auction for month ${month}.`,
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

        res.status(200).json({ 
            message: "User auction data created successfully", 
            userAuctionData 
        });
    } catch (error) {
        console.error("Error in ModifyUserAuctionDate:", error);
        res.status(500).json({ message: "Error creating user auction data", error: error.message });
    }
};