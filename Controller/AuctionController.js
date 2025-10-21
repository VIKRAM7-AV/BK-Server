import AuctionData from "../Model/auctionModel.js";
import { Auction, BookedChit } from "../Model/BookedChit.js";

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