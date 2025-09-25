import { BookedChit, Auction } from "../Model/BookedChit.js";
import ChitGroup from "../Model/ChitGroup.js";
import User from "../Model/UserModel.js";
import { Expo } from "expo-server-sdk";
import Notification from "../Model/notification.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";
import { getMonthIndex } from "../utils/dateUtils.js";
const expo = new Expo();

export const ChitGroupController = async (req, res) => {
  try {
    const newChitGroup = new ChitGroup(req.body);
    await newChitGroup.save();
    res.status(200).json(newChitGroup);
  } catch (error) {
    res.status(500).json({ message: "Error creating chit group", error });
  }
};

export const AllChitGroup = async (req, res) => {
  try {
    const chitGroups = await ChitGroup.find();
    res.status(200).json(chitGroups);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chit groups", error });
  }
};

export const UserChits = async (req, res) => {
  try {
    const userId = req.params.id;
    const userChits = await ChitGroup.find({ userId });
    if (!userChits || userChits.length === 0) {
      return res.status(404).json({ message: "Chit Data is Not Found" });
    }
    res.status(200).json(userChits);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user chits", error });
    console.error("Error fetching user chits:", error);
  }
};

export const BookingChit = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = id;
    const { chitId, bookingType } = req.body;

    if (!chitId || !userId || !bookingType) {
      return res
        .status(400)
        .json({ message: "Chit ID, User ID, and Booking Type are required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const chit = await ChitGroup.findById(chitId);
    if (!chit) {
      return res.status(404).json({ message: "Chit not found" });
    }

    // gorup user id create

    const branchCode = "001";

    // Validate chit group
    const groupCode = chit.groupCode;
    if (!groupCode) {
      return res.status(400).json({ error: "Invalid chit group" });
    }
    // Count existing bookings for this groupCode and branch to determine memberNumber
    const existingBookings = await BookedChit.countDocuments({
      GroupUserId: new RegExp(`^${groupCode}/${branchCode}/`),
    });
    const memberNumber = existingBookings + 1; // Increment for new member

    // Generate GroupUserId (e.g., BK1A/001/1)
    const groupUserId = `${groupCode}/${branchCode}/${memberNumber}`;

    // Check if GroupUserId already exists (safety check)
    const existingBooking = await BookedChit.findOne({ groupUserId });
    if (existingBooking) {
      return res.status(400).json({ error: "GroupUserId already exists" });
    }

    let CurrectRoute;
    if (bookingType === "daily") {
      const route = await User.findOne({ _id: userId }).select("route");

      if (!route || !route.route) {
        return res.status(400).json({
          message:
            "User route information is missing. Please update your profile with route details before booking a daily chit.",
        });
      }

      CurrectRoute = await WorkerRoute.findOne({ _id: route.route });
      if (!CurrectRoute) {
        return res.status(400).json({
          message:
            "No worker route found for the user's route. Please contact support.",
        });
      }
    }

    let Bookagent;
    if (bookingType === "monthly") {
      const route = await User.findOne({ _id: userId }).select("agent");

      if (!route || !route.agent) {
        return res.status(400).json({
          message:
            "User agent information is missing. Please update your profile with agent details before booking a monthly chit.",
        });
      }

      Bookagent = await Agent.findOne({ _id: route.agent });
      if (!Bookagent) {
        return res.status(400).json({
          message:
            "No agent found for the user's agent. Please contact support.",
        });
      }
    }

    const auction = new Auction({
      chitId,
      userId,
      payment: 0,
      status: "pending",
    });
    await auction.save();

    const bookedChit = new BookedChit({
      chitId,
      userId,
      GroupUserId: groupUserId,
      bookingType,
      monthlyAmount: chit.monthlyContribution,
      dailyAmount: chit.dailyContribution,
      auction: auction._id,
      collectedAmount: 0,
      status: "active",
      month: new Date(),
    });

    await bookedChit.save();
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

    res.status(200).json({ message: "Chit booked successfully", bookedChit });
  } catch (error) {
    res.status(500).json({ message: "Error booking chit", error });
    console.error("Error booking chit:", error);
  }
};

export const payment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status } = req.body;

    // Basic manual validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be a positive number" });
    }
    if (!["paid", "due"].includes(status)) {
      return res
        .status(400)
        .json({ message: 'Status must be either "paid" or "due"' });
    }

    // Fetch booked chit with user data
    let bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit) {
      return res.status(404).json({ message: "Booked Chit not found" });
    }

    // Fetch chit group for auctionTable
    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup) {
      return res.status(404).json({ message: "Chit Group not found" });
    }

    // Calculate monthIndex
    const monthIndex = getMonthIndex(bookedChit.month);
    if (monthIndex < 1 || monthIndex > chitGroup.durationMonths) {
      return res
        .status(400)
        .json({ message: "Current month is invalid for this chit" });
    }

    // Get auctionTable entry for current month
    const tableEntry = chitGroup.auctionTable[monthIndex - 1];
    if (!tableEntry) {
      return res
        .status(400)
        .json({ message: "No auctionTable entry for this month" });
    }

    // Calculate total paid for this month
    const monthPayments = bookedChit.payments
      .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    // For monthly: Apply late penalty if past 15th and not paid
    let requiredAmount = tableEntry.dueAmount;
    if (
      bookedChit.bookingType === "monthly" &&
      new Date().getDate() > 15 &&
      monthPayments === 0
    ) {
      requiredAmount = chitGroup.monthlyContribution;
      const hasPenalty = bookedChit.payments.some(
        (p) =>
          p.monthIndex === monthIndex &&
          p.status === "due" &&
          p.amount === tableEntry.dividend
      );
      if (!hasPenalty) {
        await BookedChit.findByIdAndUpdate(bookedChit._id, {
          $inc: { PenaltyAmount: tableEntry.dividend },
        });
        // Reload bookedChit after update
        bookedChit = await BookedChit.findById(id).populate("userId");
      }
    }

    // Validate payment amount for 'paid'
    if (status === "paid") {
      if (
        bookedChit.bookingType === "monthly" &&
        amount !== tableEntry.dueAmount &&
        monthIndex === 1
      ) {
        return res.status(400).json({
          message: `Payment must be exactly ₹${tableEntry.dueAmount} for month ${monthIndex}`,
        });
      }
      if (
        bookedChit.bookingType === "daily" &&
        monthPayments + amount > tableEntry.dueAmount
      ) {
        return res
          .status(400)
          .json({ message: "Payment exceeds remaining due for this month" });
      }
    }

    // Atomic update
    const updateData = {
      $push: { payments: { amount, status, monthIndex, date: new Date() } },
    };

    if (status === "paid") {
      updateData.$inc = { collectedAmount: amount };
      if (amount < tableEntry.dueAmount) {
        if (monthPayments === 0) {
          updateData.$inc.pendingAmount = -amount;
        } else {
          updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
        }
      } else if (amount > tableEntry.dueAmount) {
        if (monthPayments === 0) {
          updateData.$inc.pendingAmount = -amount;
        } else {
          updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
        }
      }
    } else if (status === "due") {
      updateData.$inc = { pendingAmount: amount };
    }

    const entryPayment = await BookedChit.findByIdAndUpdate(
      bookedChit._id,
      updateData,
      { new: true }
    );

    // Send push notification
    const user = bookedChit.userId;
    if (user?.expoPushToken) {
      const title = status === "paid" ? "Payment Successful" : "Payment Due";
      const body =
        status === "paid"
          ? `You have paid ₹${amount} successfully for month ${monthIndex}!`
          : `A payment of ₹${amount} is pending for month ${monthIndex}. Please complete it soon.`;

      const messages = [
        { to: user.expoPushToken, sound: "default", title, body },
      ];
      const chunks = expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          for (const ticket of ticketChunk) {
            if (ticket.id) {
              await Notification.create({
                userId: user._id,
                chitId: bookedChit._id,
                month: monthIndex,
                title,
                body,
                year: new Date().getFullYear(),
                notificationId: ticket.id,
                status,
              });
            } else if (ticket.status === "error") {
              console.error(`Push notification failed: ${ticket.message}`);
            }
          }
        } catch (error) {
          console.error("Error sending push notification:", error);
        }
      }
    }

    res.status(200).json({
      message: "Payment Entry Completed Successfully",
      data: { entryPayment },
    });
  } catch (error) {
    console.error("Error in payment function:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
