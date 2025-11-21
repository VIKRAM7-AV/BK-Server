import {AuctionData, UserAuctionData} from "../Model/auctionModel.js";
import { Auction, BookedChit } from "../Model/BookedChit.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";
import { Expo } from 'expo-server-sdk';
import Notification from "../Model/notification.js";
import ChitGroup from "../Model/ChitGroup.js";
import {v2 as cloudinary} from "cloudinary";
import AgentNotification from "../Model/AgentNotification.js";

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

        // Calculate date based on existingAuction.createdAt and the provided month
        // Assuming month 1 corresponds to the createdAt month, and we add (month - 1) months
        const startDate = new Date(existingAuction.createdAt);
        startDate.setMonth(startDate.getMonth() + parseInt(month) - 1);
        const date = startDate;

        const title = `Auction Participation for Month ${month}`;
        const description = `User ${bookedChit.userId.name} has participated in auction for month ${month}.`;

        const userAuctionData = new UserAuctionData({
            agentId,
            userId,
            auctionId,
            title,
            description,
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
                                body: `User ${bookedChit.userId.name} has participated in auction for month ${month}.`,
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




export const rejectAuction = async (req, res) => {
    try {
        const { auctionId } = req.params;

        if (!auctionId) {
            return res.status(400).json({ message: "Auction ID is required" });
        }

        const auction = await UserAuctionData.findOne({ _id: auctionId })
            .populate({
                path: 'userId',
                populate: { path: 'agent' }
            });

        if (!auction) {
            return res.status(404).json({ message: "Auction not found" });
        }

        if (!auction.userId) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = auction.userId;

        // Update auction status
        auction.status = "rejected";
        await auction.save();

        // Send push notification to user if they have expo push token
        if (user.expoPushToken) {
            const expo = new Expo();
            const messages = [{
                to: user.expoPushToken,
                sound: 'default',
                title: 'Auction Request Rejected',
                body: `Your auction request has been rejected.`,
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
                                title: 'Auction Request Rejected',
                                body: `Your auction request has been rejected.`,
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

        // Save agent notification if user has an agent
        if (user.agent) {
            const agentNotification = new AgentNotification({
                agentId: user.agent._id,
                title: 'User Auction Request Rejected',
                description: `User ${user.name}'s auction request has been rejected.`
            });
            await agentNotification.save();
        }

        await UserAuctionData.deleteOne({ _id: auctionId });
        res.status(200).json({ message: "Auction rejected successfully", auction });
    } catch (error) {
        console.error("Error rejecting auction:", error);
        res.status(500).json({ message: "Error rejecting auction", error });        
    }
};


export const approveAuction = async (req, res) => {
    try {
        const { auctionId } = req.params;

        if (!auctionId) {
            return res.status(400).json({ message: "Auction ID is required" });
        }

        const userAuction = await UserAuctionData.findById(auctionId)
            .populate({
                path: 'userId',
                populate: { path: 'agent' }
            });

        if (!userAuction) {
            return res.status(404).json({ message: "Auction not found" });
        }

        if (!userAuction.userId) {
            return res.status(404).json({ message: "User not found" });
        }

        const user = userAuction.userId;

        // Update user auction status to approved
        userAuction.status = "approved";
        await userAuction.save();

        // Create new AuctionData entry
        const newAuctionData = new AuctionData({
            auctionId: userAuction.auctionId,
            agentId: userAuction.agentId,
            userId: userAuction.userId._id,
            date: userAuction.date,
            amount: userAuction.amount,
            reason: userAuction.reason
        });
        await newAuctionData.save();

        // Save agent notification if user has an agent
        if (user.agent) {
            const agentNotification = new AgentNotification({
                agentId: user.agent._id,
                title: 'User Auction Request Approved',
                description: `User ${user.name}'s auction request has been approved.`
            });
            await agentNotification.save();
        }

        res.status(200).json({ 
            message: "Auction approved successfully"
        });
    } catch (error) {
        console.error("Error approving auction:", error);
        res.status(500).json({ message: "Error approving auction", error });        
    }
};


export const AllRequests = async (req, res) => {
    try {
        const requests = await AuctionData.find()
            .populate('agentId', 'name')
            .populate({
                path: 'userId',
                select: '-password -nominee',
                populate: { path: 'agent', select: 'name expoPushToken' }
            })
            .populate('auctionId');

        const uniqueUserIds = [...new Set(requests.map(req => req.userId._id.toString()))];

        // Fetch all booked chits for these users
        const allBookedChits = await BookedChit.find({ userId: { $in: uniqueUserIds } })
            .populate({
                path: 'chitId',
                select: 'chitValue durationMonths auctionTable'
            })

        // Group booked chits by userId
        const bookedChitsByUser = allBookedChits.reduce((acc, chit) => {
            const userIdStr = chit.userId._id.toString();
            if (!acc[userIdStr]) acc[userIdStr] = [];
            acc[userIdStr].push(chit);
            return acc;
        }, {});

        // Augment each request with user total pending and auction-related chit details
        const augmentedRequests = requests.map(request => {
            const userIdStr = request.userId._id.toString();
            const userBookedChits = bookedChitsByUser[userIdStr] || [];
            
            // Total pending amount for all user's booked chits
            const userTotalPending = userBookedChits.reduce((sum, chit) => sum + (chit.pendingAmount || 0), 0);
            
            // Find the booked chit related to this auctionId
            const auctionRelatedChit = userBookedChits.find(chit => 
                chit.auction && chit.auction._id.toString() === request.auctionId._id.toString()
            );
            
            // The auctionRelatedChit includes payment history via the 'payments' array
            
            return {
                ...request.toObject(), // Convert to plain object to avoid Mongoose issues
                userTotalPending,
                auctionRelatedChit: auctionRelatedChit ? {
                    ...auctionRelatedChit.toObject(),
                    payments: auctionRelatedChit.payments // Already included, but explicit for clarity
                } : null
            };
        });

        res.status(200).json({ 
            message: "Auction requests fetched successfully", 
            requests: augmentedRequests 
        });
        
    } catch (error) {
        console.error("Error fetching auction requests:", error);
        res.status(500).json({ message: "Error fetching auction requests", error });
    }
}


export const setNewAuctionDate = async (req, res) => {
    try {
        const {id} = req.params;
        const {date, amount} = req.body;

        const existingAuction = await AuctionData.findById(id);
        if (!existingAuction) {
            return res.status(404).json({ message: "Auction data not found" });
        }

        existingAuction.date = date || existingAuction.date;
        existingAuction.amount = amount || existingAuction.amount;
        await existingAuction.save();
        res.status(200).json({ message: "Auction date and amount updated successfully", auction: existingAuction });
    } catch (error) {
        console.error("Error in setNewAuctionDate:", error);
        res.status(500).json({ message: "Error setting new auction date", error: error.message });
    }
}


export const FinalAuction = async (req, res) => {
    try {
        const { id } = req.params;
        const { auctionDate, payment } = req.body;

        // Find the auction request with populated user and agent data
        const existingAuction = await AuctionData.findById(id)
            .populate({
                path: 'userId',
                populate: { path: 'agent' }
            })
            .populate('agentId')
            .populate('auctionId');

        if (!existingAuction) {
            return res.status(404).json({ message: "Auction data not found" });
        }

        const setauction = await Auction.findById(existingAuction.auctionId);
        if (!setauction) {
            return res.status(404).json({ message: "Auction not found" });
        }

        // Update auction details
        setauction.auctionDate = auctionDate || setauction.auctionDate;
        setauction.payment = payment || setauction.payment;
        await setauction.save();

        const user = existingAuction.userId;

        // Send push notification to user
        if (user && user.expoPushToken) {
            const expo = new Expo();
            const userMessage = {
                to: user.expoPushToken,
                sound: 'default',
                title: 'Auction Request Approved',
                body: `Your auction request for ₹${payment || existingAuction.amount} has been approved. Auction date: ${new Date(auctionDate).toLocaleDateString()}`,
                data: {
                    auctionId: setauction._id,
                    type: 'auction_approved'
                }
            };

            const chunks = expo.chunkPushNotifications([userMessage]);
            
            for (let chunk of chunks) {
                try {
                    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                    for (const ticket of ticketChunk) {
                        if (ticket.id) {
                            // Save user notification to database
                            await Notification.create({
                                userId: user._id,
                                title: 'Auction Request Approved',
                                body: `Your auction request for ₹${payment || existingAuction.amount} has been approved. Auction date: ${new Date(auctionDate).toLocaleDateString()}`,
                                notificationId: ticket.id
                            });
                        } else if (ticket.status === "error") {
                            console.error(`Push notification failed for user: ${ticket.message}`);
                        }
                    }
                } catch (error) {
                    console.error('Error sending push notification to user:', error);
                }
            }
        }

        // Send notification to agent
        if (user && user.agent) {
            // Send push notification to agent if they have expo push token
            if (user.agent.expoPushToken) {
                const expo = new Expo();
                const agentMessage = {
                    to: user.agent.expoPushToken,
                    sound: 'default',
                    title: 'Auction Request Approved',
                    body: `Auction request for ${user.name} has been approved for ₹${payment || existingAuction.amount}`,
                    data: {
                        userId: user._id,
                        auctionId: setauction._id,
                        type: 'auction_approved_agent'
                    }
                };

                const chunks = expo.chunkPushNotifications([agentMessage]);
                
                for (let chunk of chunks) {
                    try {
                        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
                        for (const ticket of ticketChunk) {
                            if (ticket.status === "error") {
                                console.error(`Push notification failed for agent: ${ticket.message}`);
                            }
                        }
                    } catch (error) {
                        console.error('Error sending push notification to agent:', error);
                    }
                }
            }

            // Save agent notification to database
            const agentNotification = new AgentNotification({
                agentId: user.agent._id,
                title: 'Auction Request Approved',
                description: `Auction request for user ${user.name} (${user.userId}) has been approved for ₹${payment || existingAuction.amount}. Auction date: ${new Date(auctionDate).toLocaleDateString()}`
            });
            await agentNotification.save();
        }

        // Delete the auction request after approval
        await AuctionData.findByIdAndDelete(id);

        res.status(200).json({ 
            message: "Final auction details updated successfully", 
            auction: setauction 
        });
    } catch (error) {
        console.error("Error in FinalAuction:", error);
        res.status(500).json({ 
            message: "Error in FinalAuction", 
            error: error.message 
        });
    }
}



export const AuctionCommitments = async (req, res) => {
    try {
        const now = new Date();

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // 1. Get all auctions (commitments) for the current month
        const commitments = await Auction.find({
            auctionDate: {
                $gte: startOfMonth,
                $lt: startOfNextMonth
            },status: "pending"
        })
            .populate({
                path: 'userId',
                populate: { path: 'agent', select: 'name' },
                select: '-password -nominee'
            })
            .populate({
                path: 'chitId',
                select: 'chitValue durationMonths auctionTable'
            })
            .sort({ auctionDate: 1 });

        if (commitments.length === 0) {
            return res.status(200).json({
                message: "No auction commitments found for current month",
                count: 0,
                commitments: [],
                commitmentsWithPending: []
            });
        }

        const uniqueUserIds = [...new Set(commitments.map(c => c.userId._id.toString()))];

        // 3. Fetch ALL booked chits for these users (across all chits, not just current month)
        const allBookedChits = await BookedChit.find({
            userId: { $in: uniqueUserIds }
        })
            .select('userId pendingAmount')  // we only need these fields
            .lean(); // faster, since we don't need mongoose docs here

        // 4. Group booked chits by user and calculate total pending per user
        const pendingByUser = allBookedChits.reduce((acc, booked) => {
            const userIdStr = booked.userId.toString();
            if (!acc[userIdStr]) acc[userIdStr] = 0;
            acc[userIdStr] += Number(booked.pendingAmount || 0);
            return acc;
        }, {});

        // 5. Also get booked chits that belong to current month's auctions (if you still need them separately)
        const currentMonthAuctionIds = commitments.map(c => c._id);
        const bookedChitInCurrentMonth = await BookedChit.find({
            auction: { $in: currentMonthAuctionIds }
        });

        // 6. Augment each commitment with user's TOTAL pending amount
        const commitmentsWithPending = commitments.map(commitment => {
            const userIdStr = commitment.userId._id.toString();
            const totalPendingForUser = pendingByUser[userIdStr] || 0;

            return {
                ...commitment.toObject(),
                userTotalPendingAmount: totalPendingForUser
            };
        });

        res.status(200).json({
            message: "Current month auction commitments fetched successfully",
            count: commitments.length,
            commitments: commitmentsWithPending,           // main result with pending added
            bookedChitInCurrentMonth,                      // optional: only current month's booked chits
            summary: {
                totalUsers: uniqueUserIds.length,
                totalPendingAcrossAllUsers: Object.values(pendingByUser).reduce((sum, p) => sum + p, 0)
            }
        });

    } catch (error) {
        console.error("Error in AuctionCommitments:", error);
        res.status(500).json({
            message: "Error fetching auction commitments",
            error: error.message
        });
    }
};


export const UpdateAuctionCommitment = async (req, res) => {
    let expo = new Expo();
    try {
        const { id } = req.params;
        const { auctionDate, payment } = req.body;

        if (!auctionDate) {
            return res.status(400).json({ message: "Auction date is required" });
        }

        // Step 1: Find the main Auction document (permanent one)
        const auction = await Auction.findOne({ _id: id }).populate({
            path: 'userId',
            populate: { path: 'agent', select: 'expoPushToken name' },
            select: 'expoPushToken name'
        });

        if (!auction) {
            return res.status(404).json({ message: "Auction not found" });
        }

        // Step 2: Update final auction details
        auction.auctionDate = auctionDate;
        if (payment) auction.payment = payment;
        await auction.save();

        const user = auction.userId;
        const finalAmount = payment;
        const formattedDate = new Date(auctionDate).toLocaleDateString('en-IN');

        // Step 3: Send Push to Customer
        if (user?.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
            const customerMessage = {
                to: user.expoPushToken,
                sound: 'default',
                title: 'Auction Date Updated Successfully ✅',
                body: `Great news! Your good performance rewarded.\nYour auction is scheduled on ${formattedDate} for ₹${finalAmount.toLocaleString('en-IN')}`,
                data: { auctionId: auction._id, type: 'auction_date_updated' }
            };

            try {
                const receipts = await expo.sendPushNotificationsAsync([customerMessage]);
                receipts.forEach(async (ticket) => {
                    if (ticket.id) {
                        await Notification.create({
                            userId: user._id,
                            title: 'Auction Date Updated Successfully',
                            body: `Your auction is now on ${formattedDate} for ₹${finalAmount.toLocaleString('en-IN')}`,
                            notificationId: ticket.id
                        });
                    } else if (ticket.status === 'error') {
                        console.error('Customer push failed:', ticket.message);
                    }
                });
            } catch (err) {
                console.error('Error sending push to customer:', err.message);
            }
        }

        // Step 4: Send Push + Save Notification for Agent
        if (user?.agent?.expoPushToken && Expo.isExpoPushToken(user.agent.expoPushToken)) {
            const agentMessage = {
                to: user.agent.expoPushToken,
                sound: 'default',
                title: 'Auction Approved & Date Set',
                body: `${user.name}'s auction approved due to good performance!\nDate: ${formattedDate} | Amount: ₹${finalAmount.toLocaleString('en-IN')}`,
                data: { userId: user._id, auctionId: auction._id, type: 'agent_auction_update' }
            };

            try {
                await expo.sendPushNotificationsAsync([agentMessage]);
            } catch (err) {
                console.error('Error sending push to agent:', err.message);
            }
        }

        // Save agent notification in DB
        if (user?.agent) {
            await AgentNotification.create({
                agentId: user.agent._id,
                title: 'Auction Date Confirmed',
                description: `User: ${user.name}\nAmount: ₹${finalAmount.toLocaleString('en-IN')}\nAuction Date: ${formattedDate}\nReason: Good performance month`,
                type: 'auction_approved'
            });
        }

        // Step 5: Delete the temporary request
        await AuctionData.findByIdAndDelete(id);

        // Step 6: Success response
        return res.status(200).json({
            success: true,
            message: "Auction date updated successfully due to good performance!",
            auction: {
                _id: auction._id,
                auctionDate: auction.auctionDate,
                payment: auction.payment || auction.amount,
                userId: user._id
            }
        });

    } catch (error) {
        console.error("Error in UpdateAuctionCommitment:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating auction",
            error: error.message
        });
    }
};



export const AuctionComplete = async (req, res) => {
    let expo = new Expo();
    try {
        const { id } = req.params;
        const { cheque } = req.body;
        const chequeImageFile = req.file;

        if (!chequeImageFile) {
            return res.status(400).json({ 
                message: "Cheque image is required",
                debug: {
                    body: req.body,
                    file: req.file,
                    files: req.files
                }
            });
        }

        const auction = await Auction.findById(id).populate({
            path: 'userId',
            populate: { path: 'agent', select: 'expoPushToken name' },
            select: 'expoPushToken name'
        });

        if (!auction) {
            return res.status(404).json({ message: "Auction not found" });
        }

        // Upload the file to Cloudinary using the file path from multer
        const chequeImagePath = await cloudinary.uploader.upload(chequeImageFile.path, {
            folder: 'cheque_images',
            resource_type: 'auto'
        });

        // Step 2: Update auction status to complete

        auction.status = "complete";
        auction.cheque = cheque;
        auction.chequeImage = chequeImagePath.secure_url
        await auction.save();

        const user = auction.userId;
        const Amount = auction.payment;

        // Step 3: Send Push to Customer
        if (user?.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
            const customerMessage = {
                to: user.expoPushToken,
                sound: 'default',
                title: 'Auction Completed Successfully ✅',
                body: `Congratulations! Your auction has been completed successfully.\nAmount: ₹${Amount.toLocaleString('en-IN')}`,
                data: { auctionId: auction._id, type: 'auction_completed' }
            };

            try {
                const receipts = await expo.sendPushNotificationsAsync([customerMessage]);
                receipts.forEach(async (ticket) => {
                    if (ticket.id) {
                        await Notification.create({
                            userId: user._id,
                            title: 'Auction Completed Successfully',
                            body: `Your auction has been completed successfully for ₹${Amount.toLocaleString('en-IN')}`,
                            notificationId: ticket.id
                        });
                    } else if (ticket.status === 'error') {
                        console.error('Customer push failed:', ticket.message);
                    }
                });
            } catch (err) {
                console.error('Error sending push to customer:', err.message);
            }
        }


        res.status(200).json({ message: "Auction completed successfully", auction });
    } catch (error) {
        console.error("Error in AuctionComplete:", error);
        res.status(500).json({ message: "Error completing auction", error: error.message });
    }
}




export const UpcomingAuctionsMonthWise = async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-11

        // Start from NEXT month
        const nextMonthIndex = currentMonth + 1;
        const startYear = nextMonthIndex > 11 ? currentYear + 1 : currentYear;
        const startMonthIndex = nextMonthIndex % 12; // 0-11

        // Corrected: Use startMonthIndex here
        const startFromNextMonth = new Date(startYear, startMonthIndex, 1);

        // Get ALL future pending auctions from next month onwards
        const futureAuctions = await Auction.find({
            auctionDate: { $gte: startFromNextMonth },
            status: "pending"
        })
            .populate({
                path: 'userId',
                populate: { path: 'agent', select: 'name' },
                select: '-password -nominee'
            })
            .populate({
                path: 'chitId',
                select: 'chitValue durationMonths groupCode'
            })
            .sort({ auctionDate: 1 })
            .lean();

        if (futureAuctions.length === 0) {
            return res.status(200).json({
                message: "No upcoming auctions found from next month onwards",
                totalMonths: 0,
                monthsData: []
            });
        }

        // Unique users
        const uniqueUserIds = [...new Set(futureAuctions.map(a => a.userId._id.toString()))];

        // Total pending per user (across all chits)
        const allBookedChits = await BookedChit.find({
            userId: { $in: uniqueUserIds }
        })
            .select('userId pendingAmount')
            .lean();

        const pendingByUser = allBookedChits.reduce((acc, booked) => {
            const userIdStr = booked.userId.toString();
            acc[userIdStr] = (acc[userIdStr] || 0) + Number(booked.pendingAmount || 0);
            return acc;
        }, {});

        // Group by Year-Month
        const groupedByMonth = {};

        futureAuctions.forEach(auction => {
            const date = new Date(auction.auctionDate);
            const year = date.getFullYear();
            const month = date.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;

            if (!groupedByMonth[key]) {
                groupedByMonth[key] = {
                    monthYear: key,
                    monthName: date.toLocaleString('default', { month: 'long', year: 'numeric' }),
                    startDate: new Date(year, month, 1),
                    endDate: new Date(year, month + 1, 0),
                    auctions: [],
                    totalUsers: 0,
                    totalPendingAcrossUsers: 0
                };
            }

            const userIdStr = auction.userId._id.toString();
            const userPending = pendingByUser[userIdStr] || 0;

            groupedByMonth[key].auctions.push({
                ...auction,
                userTotalPendingAmount: userPending
            });
        });

        // Add summary per month
        Object.values(groupedByMonth).forEach(monthData => {
            const userIds = [...new Set(monthData.auctions.map(a => a.userId._id.toString()))];
            monthData.totalUsers = userIds.length;
            monthData.totalPendingAcrossUsers = userIds.reduce((sum, uid) => sum + (pendingByUser[uid] || 0), 0);
        });

        // Sort months
        const sortedMonths = Object.values(groupedByMonth)
            .sort((a, b) => a.startDate - b.startDate);

        res.status(200).json({
            message: "Upcoming auctions fetched successfully (month-wise from next month)",
            totalMonths: sortedMonths.length,
            monthsData: sortedMonths
        });

    } catch (error) {
        console.error("Error in UpcomingAuctionsMonthWise:", error);
        res.status(500).json({
            message: "Error fetching month-wise upcoming auctions",
            error: error.message
        });
    }
};



export const AuctionHistory = async (req, res) => {
    try {

        const AuctionHistory = await Auction.find({status: "complete"})
            .populate({
                path: 'userId',
                populate: { path: 'agent', select: 'name' },
                select: '-password -nominee'
            })
            .sort({ auctionDate: 1 });

        if (AuctionHistory.length === 0) {
            return res.status(200).json({
                message: "No auction history found",
                count: 0,
                AuctionHistory: []
            });
        }

        const allBookedChits = await BookedChit.find({auction: { $in: AuctionHistory.map(a => a._id) }});

        res.status(200).json({
            message: "Auction history fetched successfully",
            count: AuctionHistory.length,
            AuctionHistory,
            allBookedChits
        });

    } catch (error) {
        console.error("Error in AuctionCommitments:", error);
        res.status(500).json({
            message: "Error fetching auction commitments",
            error: error.message
        });
    }
};