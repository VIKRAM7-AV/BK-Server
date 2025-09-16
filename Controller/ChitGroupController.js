import { BookedChit, Auction } from "../Model/BookedChit.js";
import ChitGroup from "../Model/ChitGroup.js";
import User from "../Model/UserModel.js";
import { Expo } from 'expo-server-sdk';
import Notification from "../Model/notification.js";


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
      bookingType,
      monthlyAmount: chit.monthlyContribution,
      auction: auction._id,
      collectedAmount: 0,
      status: "active",
      month: new Date(),
    });

    await bookedChit.save();
    user.chits.push(bookedChit._id);
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
      entryPayment.pendingAmount = Math.max(0, entryPayment.pendingAmount - amount);
      await entryPayment.save();
    }

    const user = await User.findById(bookedChit.userId);
    if (user && user.expoPushToken) {
      const pushToken = user.expoPushToken;

      let title = '';
      let body = '';

      if (status === "paid") {
        title = 'Payment Successful';
        body = `You have paid ₹${amount} successfully!`;
      } else if (status === "due") {
        title = 'Payment Due';
        body = `A payment of ₹${amount} is pending. Please complete it soon.`;
      } else {
        title = 'Payment Update';
        body = `Payment of ₹${amount} has a status: ${status}`;
      }

      const messages = [{
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
      }];

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
                status: status
              });

              await notification.save();
            }
          }

        } catch (error) {
          console.error('Error sending push notification:', error);
        }
      }
    }

    res.status(200).json({
      message: "Payment Entry Complete Successfully",
      entryPayment
    });

  } catch (error) {
    console.log("Error in payment function", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
