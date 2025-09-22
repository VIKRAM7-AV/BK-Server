import { BookedChit, Auction } from "../Model/BookedChit.js";
import ChitGroup from "../Model/ChitGroup.js";
import User from "../Model/UserModel.js";
import { Expo } from "expo-server-sdk";
import Notification from "../Model/notification.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";

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

    const bookedChit = await BookedChit.findById(id);
    if (!bookedChit) {
      return res.status(404).json({ message: "Booked Chit not found" });
    }

    const entryPayment = await BookedChit.findByIdAndUpdate(
      bookedChit._id,
      {
        $push: {
          payments: { amount, status },
        },
      },
      { new: true }
    );

    if (status === "paid") {
      entryPayment.collectedAmount += amount;
      entryPayment.pendingAmount = Math.max(
        0,
        entryPayment.pendingAmount - amount
      );
      await entryPayment.save();
    }

    const user = await User.findById(bookedChit.userId);
    if (user && user.expoPushToken) {
      const pushToken = user.expoPushToken;

      let title = "";
      let body = "";

      if (status === "paid") {
        title = "Payment Successful";
        body = `You have paid ₹${amount} successfully!`;
      } else if (status === "due") {
        title = "Payment Due";
        body = `A payment of ₹${amount} is pending. Please complete it soon.`;
      } else {
        title = "Payment Update";
        body = `Payment of ₹${amount} has a status: ${status}`;
      }

      const messages = [
        {
          to: pushToken,
          sound: "default",
          title: title,
          body: body,
        },
      ];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);

          // ✅ Save each notification to DB if ticket ID exists
          for (const ticket of ticketChunk) {
            if (ticket.id) {
              const notification = new Notification({
                userId: user._id,
                chitId: bookedChit._id,
                month: new Date().getMonth() + 1,
                title: title,
                body: body,
                year: new Date().getFullYear(),
                notificationId: ticket.id,
                status: status,
              });

              await notification.save();
            }
          }
        } catch (error) {
          console.error("Error sending push notification:", error);
        }
      }
    }

    res.status(200).json({
      message: "Payment Entry Complete Successfully",
      entryPayment,
    });
  } catch (error) {
    console.log("Error in payment function", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
