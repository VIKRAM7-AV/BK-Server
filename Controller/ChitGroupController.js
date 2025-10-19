import { BookedChit, Auction } from "../Model/BookedChit.js";
import ChitGroup from "../Model/ChitGroup.js";
import User from "../Model/UserModel.js";
import { Expo } from "expo-server-sdk";
import Notification from "../Model/notification.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";
import { getDayIndex, getMonthIndex } from "../utils/dateUtils.js";
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

// export const monthlypayment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { amount, status } = req.body;

//     // Basic manual validation
//     if (!amount || typeof amount !== "number" || amount <= 0) {
//       return res
//         .status(400)
//         .json({ message: "Amount must be a positive number" });
//     }
//     if (!["paid", "due"].includes(status)) {
//       return res
//         .status(400)
//         .json({ message: 'Status must be either "paid" or "due"' });
//     }

//     // Fetch booked chit with user data
//     let bookedChit = await BookedChit.findById(id).populate("userId");
//     if (!bookedChit) {
//       return res.status(404).json({ message: "Booked Chit not found" });
//     }

//     if (bookedChit.bookingType !== "monthly") {
//       return res
//         .status(400)
//         .json({ message: "This is not a monthly booked chit" });
//     }

//     // Fetch chit group for auctionTable
//     const chitGroup = await ChitGroup.findById(bookedChit.chitId);
//     if (!chitGroup) {
//       return res.status(404).json({ message: "Chit Group not found" });
//     }

//     // Calculate monthIndex
//     const monthIndex = getMonthIndex(bookedChit.month);
//     if (monthIndex < 1 || monthIndex > chitGroup.durationMonths) {
//       return res
//         .status(400)
//         .json({ message: "Current month is invalid for this chit" });
//     }

//     // Get auctionTable entry for current month
//     const tableEntry = chitGroup.auctionTable[monthIndex - 1];
//     if (!tableEntry) {
//       return res
//         .status(400)
//         .json({ message: "No auctionTable entry for this month" });
//     }

//     // Validate payment amount for 'paid'
//     if (status === "paid") {
//       if (
//         bookedChit.bookingType === "monthly" &&
//         amount !== tableEntry.dueAmount &&
//         monthIndex === 1
//       ) {
//         return res.status(400).json({
//           message: `Payment must be exactly ₹${tableEntry.dueAmount} for month ${monthIndex}`,
//         });
//       }
//       if (
//         bookedChit.bookingType === "daily" &&
//         monthPayments + amount > tableEntry.dueAmount
//       ) {
//         return res
//           .status(400)
//           .json({ message: "Payment exceeds remaining due for this month" });
//       }
//     }

//     // Calculate total paid for this month
//     const monthPayments = bookedChit.payments
//       .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
//       .reduce((sum, p) => sum + p.amount, 0);

//     // For monthly: Apply late penalty if past 15th and not paid
//     let requiredAmount = tableEntry.dueAmount;
//     if (
//       bookedChit.bookingType === "monthly" &&
//       new Date().getDate() > 15 &&
//       monthPayments === 0
//     ) {
//       requiredAmount = chitGroup.monthlyContribution;
//       const hasPenalty = bookedChit.payments.some(
//         (p) => p.monthIndex === monthIndex
//       );
//       if (!hasPenalty) {
//         await BookedChit.findByIdAndUpdate(bookedChit._id, {
//           $inc: { PenaltyAmount: tableEntry.dividend },
//         });
//         // Reload bookedChit after update
//         bookedChit = await BookedChit.findById(id).populate("userId");
//       }
//     }

//     // Atomic update
//     const updateData = {
//       $push: { payments: { amount, status, monthIndex, date: new Date() } },
//     };

//     // if (status === "paid") {
//     //   updateData.$inc = { collectedAmount: amount };

//     //   if (amount < tableEntry.dueAmount) {
//     //     const hasPaid = bookedChit.payments.some(
//     //       (p) => p.monthIndex === monthIndex
//     //     );
//     //     if (hasPaid) {
//     //       if (monthPayments === 0) {
//     //         updateData.$inc.pendingAmount = - amount;
//     //       }
//     //     } else if(monthPayments !== 0){
//     //       updateData.$inc.pendingAmount = - amount;
//     //     } else {
//     //       updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
//     //     }
//     //   } else if (amount > tableEntry.dueAmount) {
//     //     const hasPaid = bookedChit.payments.some(
//     //       (p) => p.monthIndex === monthIndex
//     //     );
//     //     if (hasPaid) {
//     //       if (monthPayments === 0) {
//     //         updateData.$inc.pendingAmount = -amount;
//     //       }
//     //     } else if(monthPayments !== 0){
//     //       updateData.$inc.pendingAmount = -amount;
//     //     } else {
//     //       updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
//     //     }
//     //   }

//   if (status === "paid") {
//   updateData.$inc = { collectedAmount: amount };

//   if (amount < tableEntry.dueAmount) {
//     const hasPaid = bookedChit.payments.some(
//       (p) => p.monthIndex === monthIndex
//     );

//     if (hasPaid) {
//       if (monthPayments >= 0) {
//         updateData.$inc.pendingAmount = -amount;
//       }
//     } else {
//       // first payment → reduce from pending
//       updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
//     }
//   } else if (amount > tableEntry.dueAmount) {
//     const hasPaid = bookedChit.payments.some(
//       (p) => p.monthIndex === monthIndex
//     );

//     if (hasPaid) {
//       if (monthPayments >= 0) {
//         updateData.$inc.pendingAmount = -amount;
//       }
//     } else {
//       // first payment → reduce from pending
//       updateData.$inc.pendingAmount = tableEntry.dueAmount - amount;
//     }
//   }
// } else if (status === "due") {
//       const hasDue = bookedChit.payments.some(
//         (p) => p.monthIndex === monthIndex
//       );
//       if (hasDue) {
//         return res
//           .status(400)
//           .json({ message: "You can only mark due for the current month" });
//       } else {
//         updateData.$inc = { pendingAmount: tableEntry.dueAmount };
//       }
//     }

//     const entryPayment = await BookedChit.findByIdAndUpdate(
//       bookedChit._id,
//       updateData,
//       { new: true }
//     );

//     // Send push notification
//     const user = bookedChit.userId;
//     if (user?.expoPushToken) {
//       const title = status === "paid" ? "Payment Successful" : "Payment Due";
//       const body =
//         status === "paid"
//           ? `You have paid ₹${amount} successfully for month ${monthIndex}!`
//           : `A payment of ₹${amount} is pending for month ${monthIndex}. Please complete it soon.`;

//       const messages = [
//         { to: user.expoPushToken, sound: "default", title, body },
//       ];
//       const chunks = expo.chunkPushNotifications(messages);

//       for (const chunk of chunks) {
//         try {
//           const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
//           for (const ticket of ticketChunk) {
//             if (ticket.id) {
//               await Notification.create({
//                 userId: user._id,
//                 chitId: bookedChit._id,
//                 month: monthIndex,
//                 title,
//                 body,
//                 year: new Date().getFullYear(),
//                 notificationId: ticket.id,
//                 status,
//               });
//             } else if (ticket.status === "error") {
//               console.error(`Push notification failed: ${ticket.message}`);
//             }
//           }
//         } catch (error) {
//           console.error("Error sending push notification:", error);
//         }
//       }
//     }

//     res.status(200).json({
//       message: "Payment Entry Completed Successfully",
//       data: { entryPayment },
//     });
//   } catch (error) {
//     console.error("Error in payment function:", error);
//     res.status(500).json({ message: "Internal server error" });
//   }
// };



export const monthlypayment = async (req, res) => {
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

    if (bookedChit.bookingType !== "monthly") {
      return res
        .status(400)
        .json({ message: "This is not a monthly booked chit" });
    }

    // Fetch chit group for auctionTable
    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup) {
      return res.status(404).json({ message: "Chit Group not found" });
    }

    // Custom monthIndex calculation for chit periods (10th to 9th)
    const getChitMonthKey = (date) => {
      const d = new Date(date);
      let year = d.getFullYear();
      let month = d.getMonth() + 1;
      if (d.getDate() < 10) {
        month = month === 1 ? 12 : month - 1;
        year = month === 12 ? year - 1 : year;
      }
      return year * 12 + month;
    };
    const joinKey = getChitMonthKey(bookedChit.month);
    const currentKey = getChitMonthKey(new Date());
    const monthIndex = currentKey - joinKey + 1;

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
    let monthPayments = bookedChit.payments
      .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    // For monthly: Apply late penalty if past 15th in chit period and not paid
    const currentChitMonthNum = currentKey % 12 || 12;
    const chitYear = Math.floor(currentKey / 12);
    const penaltyDate = new Date(chitYear, currentChitMonthNum - 1, 15);
    if (
      bookedChit.bookingType === "monthly" &&
      new Date() > penaltyDate &&
      monthPayments === 0
    ) {
      const hasAnyPayment = bookedChit.payments.some(
        (p) => p.monthIndex === monthIndex
      );
      if (!hasAnyPayment) {
        await BookedChit.findByIdAndUpdate(bookedChit._id, {
          $inc: { PenaltyAmount: tableEntry.dividend },
        });
        // Reload bookedChit after update (though payments unchanged)
        bookedChit = await BookedChit.findById(id).populate("userId");
      }
    }

    // Recalculate after possible reload (though not necessary for payments)
    const hasCurrentEntry = bookedChit.payments.some(
      (p) => p.monthIndex === monthIndex
    );

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
    } else if (status === "due") {
      if (hasCurrentEntry) {
        return res
          .status(400)
          .json({ message: "You can only mark due once for the current month" });
      }
      if (amount !== tableEntry.dueAmount) {
        return res
          .status(400)
          .json({
            message: `Due amount must be exactly ₹${tableEntry.dueAmount} for month ${monthIndex}`,
          });
      }
    }

    // Auto add 'due' entries for any missed previous months
    const missedPayments = [];
    let missedDueTotal = 0;
    for (let m = 1; m < monthIndex; m++) {
      const hasEntryForM = bookedChit.payments.some((p) => p.monthIndex === m);
      if (!hasEntryForM) {
        const prevTable = chitGroup.auctionTable[m - 1];
        missedPayments.push({
          amount: prevTable.dueAmount,
          status: "due",
          monthIndex: m,
          date: new Date(),
        });
        missedDueTotal += prevTable.dueAmount;
      }
    }

    // Prepare payments to push
    const currentPayment = {
      amount,
      status,
      monthIndex,
      date: new Date(),
    };
    const allNewPayments = missedPayments.length > 0 ? [...missedPayments, currentPayment] : [currentPayment];

    // Atomic update
    const updateData = {
      $push: { payments: { $each: allNewPayments } },
    };

    // Handle increments
    updateData.$inc = {};
    let pendingInc = missedDueTotal;

    if (status === "paid") {
      updateData.$inc.collectedAmount = amount;
      const thisMonthPendingInc = hasCurrentEntry ? -amount : tableEntry.dueAmount - amount;
      pendingInc += thisMonthPendingInc;
    } else if (status === "due") {
      pendingInc += tableEntry.dueAmount;
    }

    updateData.$inc.pendingAmount = pendingInc;

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



export const dailypayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status } = req.body;

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

    let bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit)
      return res.status(404).json({ message: "Booked Chit not found" });
    if (bookedChit.bookingType !== "daily") {
      return res
        .status(400)
        .json({ message: "This is not a daily booked chit" });
    }

    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup)
      return res.status(404).json({ message: "Chit Group not found" });

    // ✅ Get monthIndex (10th → 9th cycle)
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

    // 🚫 CHECK: Only one entry per day allowed
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today
    
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999); // End of today

    const hasEntryToday = bookedChit.payments.some((p) => {
      const paymentDate = new Date(p.date);
      return paymentDate >= today && paymentDate <= todayEnd;
    });

    if (hasEntryToday) {
      return res.status(400).json({ 
        message: "Payment entry already exists for today. Only one entry per day is allowed." 
      });
    }

    // ✅ Total paid in this month
    const monthPayments = bookedChit.payments
      .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    // Validate 'paid'
    if (status === "paid") {
      if (
        monthPayments + amount > tableEntry.dueAmount &&
        bookedChit.pendingAmount === 0
      ) {
        return res
          .status(400)
          .json({ message: "Payment exceeds remaining due for this month" });
      } else if (
        bookedChit.pendingAmount >= 0 &&
        amount > bookedChit.pendingAmount + bookedChit.dailyAmount
      ) {
        return res
          .status(400)
          .json({ message: "Payment exceeds your pending amount" });
      }
    }

    // For daily: Apply late penalty if past 9th and not paid
    let requiredAmount = tableEntry.dueAmount;

    if (
      bookedChit.bookingType === "daily" &&
      new Date().getDate() > 9 &&
      monthPayments === 0 &&
      monthPayments < tableEntry.dueAmount
    ) {
      requiredAmount = chitGroup.monthlyContribution;

      const hasPenalty = bookedChit.payments.some(
        (p) => p.monthIndex === monthIndex
      );
      console.log("hasPenalty", hasPenalty);

      if (!hasPenalty) {
        // 🔒 prevent monthIndex - 2 < 0
        if (monthIndex > 1) {
          const penaltyEntry = chitGroup.auctionTable[monthIndex - 2];
          if (!penaltyEntry) {
            return res
              .status(400)
              .json({ message: "No auctionTable entry for this month" });
          }

          await BookedChit.findByIdAndUpdate(bookedChit._id, {
            $inc: { PenaltyAmount: penaltyEntry.dividend },
          });

          bookedChit = await BookedChit.findById(id).populate("userId");
        } else {
          console.log("⚠️ First month: no penalty applied");
        }
      }
    }

    // ✅ Atomic update with monthIndex
    const updateData = {
      $push: { payments: { amount, status, monthIndex, date: new Date() } },
    };

    if (status === "paid") {
      if (bookedChit.dailyAmount == amount) {
        updateData.$inc = { collectedAmount: amount };
      } else if (bookedChit.dailyAmount < amount) {
        updateData.$inc = { collectedAmount: amount };
        updateData.$inc.pendingAmount = bookedChit.dailyAmount - amount;
      } else if (bookedChit.dailyAmount > amount) {
        updateData.$inc = { collectedAmount: amount };
        updateData.$inc.pendingAmount = bookedChit.dailyAmount - amount;
      }
    } else if (status === "due") {
      updateData.$inc = { pendingAmount: bookedChit.dailyAmount };
    }

    const entryPayment = await BookedChit.findByIdAndUpdate(
      bookedChit._id,
      updateData,
      { new: true }
    );

    // 🔔 Push notification
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




