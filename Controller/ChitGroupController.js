import { BookedChit, Auction } from "../Model/BookedChit.js";
import ChitGroup from "../Model/ChitGroup.js";
import User from "../Model/UserModel.js";
import { Expo } from "expo-server-sdk";
import Notification from "../Model/notification.js";
import WorkerRoute from "../Model/WorkerRoute.js";
import Agent from "../Model/AgentModal.js";
import { getMonthIndex } from "../utils/dateUtils.js";
import { ChitExit } from "../Model/EnquiryModal.js";
import AgentNotification from "../Model/AgentNotification.js";
const expo = new Expo();

// Helper function to check and update BookedChit status based on lastDate and pendingAmount
const checkAndUpdateChitStatus = async (bookedChitId) => {
  try {
    const bookedChit = await BookedChit.findById(bookedChitId);
    if (!bookedChit) return;

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // If lastDate exists and current date is >= lastDate
    if (bookedChit.lastDate) {
      const lastDate = new Date(bookedChit.lastDate);
      lastDate.setHours(0, 0, 0, 0);

      if (currentDate >= lastDate) {
        if (bookedChit.pendingAmount === 0) {
          // No pending amount, mark as completed
          await BookedChit.findByIdAndUpdate(bookedChitId, {
            status: "completed"
          });
          console.log(`BookedChit ${bookedChitId} status updated to completed`);
        } else if (bookedChit.pendingAmount !== 0) {
          // Has pending amount, mark as arrear
          await BookedChit.findByIdAndUpdate(bookedChitId, {
            status: "arrear"
          });
          console.log(`BookedChit ${bookedChitId} status updated to arrear`);
        }
      }
    }
  } catch (error) {
    console.error(`Error updating chit status for ${bookedChitId}:`, error);
  }
};

// Function to validate and update status after payment entry
const validateAndUpdateStatus = async (bookedChitId) => {
  await checkAndUpdateChitStatus(bookedChitId);
};

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

export const AllChitPlans = async (req, res) => {
  try {
    const chitPlans = await ChitGroup.find().select('groupCode chitValue durationMonths monthlyContribution dailyContribution');
    res.status(200).json(chitPlans);
  } catch (error) {
    res.status(500).json({ message: "Error fetching chit plans", error });    
  }
}

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

    // Calculate lastDate based on durationMonths from chit group
    const startDate = new Date();
    const lastDate = new Date(startDate);
    lastDate.setMonth(lastDate.getMonth() + chit.durationMonths);

    const bookedChit = new BookedChit({
      chitId,
      userId,
      GroupUserId: groupUserId,
      bookingType,
      monthlyAmount: chit.monthlyContribution || 0,
      dailyAmount: chit.dailyContribution || 0,
      auction: auction._id,
      collectedAmount: 0,
      status: "active",
      month: startDate,
      lastDate: lastDate,
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

export const ArrearPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    // Basic manual validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be a positive number" });
    }

    // Fetch booked chit with user data
    let bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit) {
      return res.status(404).json({ message: "Booked Chit not found" });
    }

    // Check if sufficient pending amount
    if (bookedChit.pendingAmount < amount) {
      return res
        .status(400)
        .json({ message: "Refund amount exceeds pending amount" });
    }

    // Prepare update
    let updateData = {
      $inc: { pendingAmount: -amount
        , collectedAmount: amount
       }
    };

    // Check if pending will become 0 or less
    if (bookedChit.pendingAmount - amount <= 0) {
      updateData.$set = { status: "complete" };
    }

    // Atomic update
    const updatedChit = await BookedChit.findByIdAndUpdate(
      bookedChit._id,
      updateData,
      { new: true }
    ).populate("userId");

    res.status(200).json({
      message: "Refund Processed Successfully",
      data: { updatedChit }
    });
  } catch (error) {
    console.error("Error in refund function:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const rejectChitExit = async (req, res) => {
  try {
    const { id } = req.params;

    const exitNotification = await ChitExit.findOne({ _id: id });
    if (!exitNotification) {
      return res.status(404).json({ message: "Pending chit exit request not found" });
    }

    // Get the booked chit and populate userId to get user details and agent
    const bookedChit = await BookedChit.findOne({ _id: exitNotification.bookedchit })
      .populate({
        path: 'userId',
        populate: { path: 'agent' }
      });

    if (!bookedChit || !bookedChit.userId) {
      return res.status(404).json({ message: "Booked chit or user not found" });
    }

    const user = bookedChit.userId;

    // Send push notification to user if they have expo push token
    if (user.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: user.expoPushToken,
        sound: 'default',
        title: 'Chit Exit Rejected',
        body: `Your request to exit the chit has been rejected.`,
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
                title: 'Chit Exit Rejected',
                body: `Your request to exit the chit has been rejected.`,
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
      title: 'User Chit Exit Rejected',
      description: `User ${user.name}'s chit exit request has been rejected.`
    });
    await agentNotification.save();

    // Delete the chit exit notification
    await ChitExit.deleteOne({ _id: exitNotification._id });

    res.status(200).json({ message: "Chit exit rejected successfully" });
    
  } catch (error) {
    console.error("Error rejecting chit exit:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
};

export const approveChitExit = async (req, res) => {
  try {
    const { id } = req.params; // notification id
    
    // Find the pending chit exit notification
    const exitNotification = await ChitExit.findOne({ _id: id });
    if (!exitNotification) {
      return res.status(404).json({ message: "Pending chit exit request not found" });
    }

    // Get the booked chit and populate userId to get user details and agent
    const bookedChit = await BookedChit.findById(exitNotification.bookedchit)
      .populate({
        path: 'userId',
        populate: { path: 'agent' }
      });

    if (!bookedChit || !bookedChit.userId) {
      return res.status(404).json({ message: "Booked chit or user not found" });
    }

    const user = bookedChit.userId;

    // Update the booked chit status to 'closed'
    await BookedChit.findByIdAndUpdate(
      exitNotification.bookedchit,
      { status: 'closed' },
      { new: true }
    );

    // Update the booked chit status to 'closed'
    await Auction.findByIdAndUpdate(
      bookedChit.auction,
      { status: 'cancel' },
      { new: true }
    );

    // Send push notification to user if they have expo push token
    if (user.expoPushToken) {
      const expo = new Expo();
      const messages = [{
        to: user.expoPushToken,
        sound: 'default',
        title: 'Chit Exit Approved',
        body: `Your request to exit the chit has been approved.`,
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
                title: 'Chit Exit Approved',
                body: `Your request to exit the chit has been approved.`,
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
      title: 'User Chit Exit Approved',
      description: `User ${user.name}'s chit exit request has been approved.`
    });
    await agentNotification.save();

  // Delete the chit exit notification
    await ChitExit.deleteOne({ _id: exitNotification._id });

    res.status(200).json({ message: "Chit exit approved successfully" });
    
  } catch (error) {
    console.error("Error approving chit exit:", error);
    res.status(500).json({ message: "Internal server error" });    
  }
};


// export const dailypayment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { amount, status } = req.body;

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

//     let bookedChit = await BookedChit.findById(id).populate("userId");
//     if (!bookedChit)
//       return res.status(404).json({ message: "Booked Chit not found" });
//     if (bookedChit.bookingType !== "daily") {
//       return res
//         .status(400)
//         .json({ message: "This is not a daily booked chit" });
//     }

//     const chitGroup = await ChitGroup.findById(bookedChit.chitId);
//     if (!chitGroup)
//       return res.status(404).json({ message: "Chit Group not found" });

//     // ✅ Get monthIndex (10th → 9th cycle)
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

//     // 🚫 CHECK: Only one entry per day allowed
//     const today = new Date();
//     today.setHours(0, 0, 0, 0); // Start of today
    
//     const todayEnd = new Date(today);
//     todayEnd.setHours(23, 59, 59, 999); // End of today

//     const hasEntryToday = bookedChit.payments.some((p) => {
//       const paymentDate = new Date(p.date);
//       return paymentDate >= today && paymentDate <= todayEnd;
//     });

//     if (hasEntryToday) {
//       return res.status(400).json({ 
//         message: "Payment entry already exists for today. Only one entry per day is allowed." 
//       });
//     }

//     // ✅ Total paid in this month
//     const monthPayments = bookedChit.payments
//       .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
//       .reduce((sum, p) => sum + p.amount, 0);

//     // Validate 'paid'
//     if (status === "paid") {
//       if (
//         monthPayments + amount > tableEntry.dueAmount &&
//         bookedChit.pendingAmount === 0
//       ) {
//         return res
//           .status(400)
//           .json({ message: "Payment exceeds remaining due for this month" });
//       } else if (
//         bookedChit.pendingAmount >= 0 &&
//         amount > bookedChit.pendingAmount + bookedChit.dailyAmount
//       ) {
//         return res
//           .status(400)
//           .json({ message: "Payment exceeds your pending amount" });
//       }
//     }

//     // For daily: Apply late penalty if past 9th and not paid
//     let requiredAmount = tableEntry.dueAmount;

//     if (
//       bookedChit.bookingType === "daily" &&
//       new Date().getDate() > 9 &&
//       monthPayments === 0 &&
//       monthPayments < tableEntry.dueAmount
//     ) {
//       requiredAmount = chitGroup.monthlyContribution;

//       const hasPenalty = bookedChit.payments.some(
//         (p) => p.monthIndex === monthIndex
//       );

//       if (!hasPenalty) {
//         // 🔒 prevent monthIndex - 2 < 0
//         if (monthIndex > 1) {
//           const penaltyEntry = chitGroup.auctionTable[monthIndex - 2];
//           if (!penaltyEntry) {
//             return res
//               .status(400)
//               .json({ message: "No auctionTable entry for this month" });
//           }

//           await BookedChit.findByIdAndUpdate(bookedChit._id, {
//             $inc: { PenaltyAmount: penaltyEntry.dividend },
//           });

//           bookedChit = await BookedChit.findById(id).populate("userId");
//         } else {
//           return res.status(400).json({ message: "No penalty applied" });
//         }
//       }
//     }

//     // ✅ Atomic update with monthIndex
//     const updateData = {
//       $push: { payments: { amount, status, monthIndex, date: new Date() } },
//     };

//     if (status === "paid") {
//       if (bookedChit.dailyAmount == amount) {
//         updateData.$inc = { collectedAmount: amount };
//       } else if (bookedChit.dailyAmount < amount) {
//         updateData.$inc = { collectedAmount: amount };
//         updateData.$inc.pendingAmount = bookedChit.dailyAmount - amount;
//       } else if (bookedChit.dailyAmount > amount) {
//         updateData.$inc = { collectedAmount: amount };
//         updateData.$inc.pendingAmount = bookedChit.dailyAmount - amount;
//       }
//     } else if (status === "due") {
//       updateData.$inc = { pendingAmount: bookedChit.dailyAmount };
//     }

//     const entryPayment = await BookedChit.findByIdAndUpdate(
//       bookedChit._id,
//       updateData,
//       { new: true }
//     );

//     // 🔔 Push notification
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

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (!["paid", "due"].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "paid" or "due"' });
    }

    let bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit) return res.status(404).json({ message: "Booked Chit not found" });

    if (bookedChit.bookingType !== "monthly") {
      return res.status(400).json({ message: "This is not a monthly booked chit" });
    }

    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup) return res.status(404).json({ message: "Chit Group not found" });

    // Month logic
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
      return res.status(400).json({ message: "Invalid month in chit cycle" });
    }

    const tableEntry = chitGroup.auctionTable[monthIndex - 1];
    if (!tableEntry) {
      return res.status(400).json({ message: "No auction table for this month" });
    }

    // --- Identify Chit Type ---
    const isFirstPayment = bookedChit.payments.length === 0;
    const isRegularChit = isFirstPayment && bookedChit.pendingAmount === 0;
    const isVacantChit = isFirstPayment && bookedChit.pendingAmount > 0;

    // total paid this month
    let monthPayments = bookedChit.payments
      .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    const hasCurrentEntry = bookedChit.payments.some((p) => p.monthIndex === monthIndex);
    const remainDue = tableEntry.dueAmount - monthPayments;
    

    const hasThisMonth = bookedChit.payments.some((p) => p.monthIndex === monthIndex);

    // --- Payment Validations ---
    if (status === "paid") {
      // If this month already has entry, can only pay up to pendingAmount
      if (hasCurrentEntry) {
        if (amount > bookedChit.pendingAmount) {
          return res.status(400).json({ 
            message: `Payment cannot exceed remaining pending amount ₹${bookedChit.pendingAmount}` 
          });
        }
      } else {
        // First payment for this month
        // Maximum allowed = dueAmount + pendingAmount
        const maxAllowed = tableEntry.dueAmount + bookedChit.pendingAmount;
        
        if (amount > maxAllowed) {
          return res.status(400).json({ 
            message: `Payment cannot exceed ₹${maxAllowed} (Due: ₹${tableEntry.dueAmount} + Pending: ₹${bookedChit.pendingAmount})` 
          });
        }

        // For regular chit first payment, must pay exact dueAmount
        if (isRegularChit && amount !== tableEntry.dueAmount) {
          return res.status(400).json({ 
            message: `Must pay exact ₹${tableEntry.dueAmount} as first payment` 
          });
        }
      }
    }

    if (status === "due") {
      if (hasThisMonth) {
        return res.status(400).json({ message: "Due already marked for this month" });
      }

      if (amount !== tableEntry.dueAmount) {
        return res.status(400).json({ message: `Due must be exact ₹${tableEntry.dueAmount}` });
      }
    }

    // --- Late Penalty (after 15th) ---
    const currentChitMonth = currentKey % 12 || 12;
    const currentYear = Math.floor(currentKey / 12);
    const penaltyDate = new Date(currentYear, currentChitMonth - 1, 15);
    let hasPaymentThisMonth = bookedChit.payments.some((p) => p.monthIndex === monthIndex);

    if (new Date() > penaltyDate && !hasPaymentThisMonth) {
      if (isRegularChit || (!isRegularChit && bookedChit.payments.length > 0)) {
        await BookedChit.findByIdAndUpdate(bookedChit._id, {
          $inc: { PenaltyAmount: tableEntry.dividend },
        });
        bookedChit = await BookedChit.findById(id).populate("userId");
      }
    }

    // --- Missed dues auto add (Only Regular and only on first entry for the month) ---
    const missedPayments = [];
    let missedDueTotal = 0;

    if (!hasThisMonth && !isVacantChit) {
      for (let m = 1; m < monthIndex; m++) {
        const monthPaymentsM = bookedChit.payments
          .filter((p) => p.monthIndex === m && p.status === "paid")
          .reduce((sum, p) => sum + p.amount, 0);
        const prevTable = chitGroup.auctionTable[m - 1];
        const unpaidM = prevTable.dueAmount - monthPaymentsM;
        if (unpaidM === prevTable.dueAmount) {
          missedPayments.push({
            amount: unpaidM,
            status: "due",
            monthIndex: m,
            date: new Date(),
          });
          missedDueTotal += unpaidM;
        }
      }
    }

    const currentPayment = { amount, status, monthIndex, date: new Date() };
    const allPayments = [...missedPayments, currentPayment];

    const update = {
      $push: { payments: { $each: allPayments } },
      $inc: {}
    };

    // --- CORRECTED LOGIC: Calculate pending increment ---
    let pendingInc = missedDueTotal;

    if (status === "paid") {
      update.$inc.collectedAmount = amount;
      
      if (hasCurrentEntry) {
        // This month already has payment, reduce pending by payment amount
        pendingInc -= amount;
      } else {
        // First payment for this month
        const thisMonthPendingInc = tableEntry.dueAmount - amount;
        pendingInc += thisMonthPendingInc;
      }
    } else if (status === "due") {
      pendingInc += tableEntry.dueAmount;
    }

    update.$inc.pendingAmount = pendingInc;

    const entryPayment = await BookedChit.findByIdAndUpdate(bookedChit._id, update, { new: true });

    // Check and update status based on lastDate and pendingAmount
    await validateAndUpdateStatus(bookedChit._id);

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

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const dailypayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (!["paid", "due"].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "paid" or "due"' });
    }

    let bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit) return res.status(404).json({ message: "Booked Chit not found" });

    if (bookedChit.bookingType !== "daily") {
      return res.status(400).json({ message: "This is not a daily booked chit" });
    }

    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup) return res.status(404).json({ message: "Chit Group not found" });

    // Get monthIndex (10th → 9th cycle)
    const monthIndex = getMonthIndex(bookedChit.month);
    if (monthIndex < 1 || monthIndex > chitGroup.durationMonths) {
      return res.status(400).json({ message: "Current month is invalid for this chit" });
    }

    const tableEntry = chitGroup.auctionTable[monthIndex - 1];
    if (!tableEntry) {
      return res.status(400).json({ message: "No auctionTable entry for this month" });
    }

    // --- CHECK: Only one entry per day allowed ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const hasEntryToday = bookedChit.payments.some((p) => {
      const paymentDate = new Date(p.date);
      return paymentDate >= today && paymentDate <= todayEnd;
    });

    if (hasEntryToday) {
      return res.status(400).json({ 
        message: "Payment entry already exists for today. Only one entry per day is allowed." 
      });
    }

    // --- Identify Chit Type ---
    const isFirstPayment = bookedChit.payments.length === 0;
    const isRegularChit = isFirstPayment && bookedChit.pendingAmount === 0;
    const isVacantChit = isFirstPayment && bookedChit.pendingAmount > 0;

    // Total paid this month
    const monthPayments = bookedChit.payments
      .filter((p) => p.monthIndex === monthIndex && p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    const hasCurrentEntry = bookedChit.payments.some((p) => p.monthIndex === monthIndex);
    const remainDue = tableEntry.dueAmount - monthPayments;

    // --- Payment Validations ---
    if (status === "paid") {
      // If this month already has entry, can only pay up to pendingAmount
      if (hasCurrentEntry) {
        const remainPending = bookedChit.pendingAmount + bookedChit.dailyAmount;
        if (amount > remainPending) {
          return res.status(400).json({ 
            message: `Payment cannot exceed remaining pending amount ₹${remainPending}` 
          });
        }
      } else {
        // First payment for this month
        // Maximum allowed = dueAmount + pendingAmount
        const maxAllowed = tableEntry.dueAmount + bookedChit.pendingAmount;
        
        if (amount > maxAllowed) {
          return res.status(400).json({ 
            message: `Payment cannot exceed ₹${maxAllowed} (Due: ₹${tableEntry.dueAmount} + Pending: ₹${bookedChit.pendingAmount})` 
          });
        }

        // For regular chit first payment, must pay exact dailyAmount
        if (isRegularChit && amount !== bookedChit.dailyAmount) {
          return res.status(400).json({ 
            message: `Must pay exact ₹${bookedChit.dailyAmount} as first payment` 
          });
        }
      }
    }

    if (status === "due") {

      if (amount !== bookedChit.dailyAmount) {
        return res.status(400).json({ message: `Due must be exact ₹${bookedChit.dailyAmount}` });
      }
    }

    // --- Late Penalty (after 9th) ---
    if (new Date().getDate() > 9 && !hasCurrentEntry) {
      if (isRegularChit || (!isRegularChit && bookedChit.payments.length > 0)) {
        if (monthIndex > 1) {
          const penaltyEntry = chitGroup.auctionTable[monthIndex - 2];
          if (penaltyEntry) {
            await BookedChit.findByIdAndUpdate(bookedChit._id, {
              $inc: { PenaltyAmount: penaltyEntry.dividend },
            });
            bookedChit = await BookedChit.findById(id).populate("userId");
          }
        }
      }
    }

    // --- Missed dues auto add (Only Regular and only on first entry for the month) ---
    const missedPayments = [];
    let missedDueTotal = 0;

    if (!hasCurrentEntry && !isVacantChit) {
      for (let m = 1; m < monthIndex; m++) {
        const monthPaymentsM = bookedChit.payments
          .filter((p) => p.monthIndex === m && p.status === "paid")
          .reduce((sum, p) => sum + p.amount, 0);

        const monthlyPaymentD = bookedChit.payments
          .filter((p) => p.monthIndex === m && p.status === "due")
          .reduce((sum, p) => sum + p.amount, 0);

        const prevTable = chitGroup.auctionTable[m - 1];


        const unpaidM = prevTable.dueAmount - monthPaymentsM;
        const unpaidD = prevTable.dueAmount - monthlyPaymentD;

        
        if (unpaidM === prevTable.dueAmount && unpaidD === 0) {
            missedPayments.push({
              amount: unpaidM,
              status: "due",
              monthIndex: m,
              date: new Date(),
            });
            missedDueTotal += unpaidM;
        }
      }
    }

    const currentPayment = { amount, status, monthIndex, date: new Date() };
    const allPayments = [...missedPayments, currentPayment];

    const update = {
      $push: { payments: { $each: allPayments } },
      $inc: {}
    };

    // --- Calculate pending increment ---
    let pendingInc = missedDueTotal;
    console.log(`Missed due total: ₹${missedDueTotal}`);

    if (status === "paid") {
      update.$inc.collectedAmount = amount;
      
      if (hasCurrentEntry) {
        // This month already has payment
        // If paying towards old pending, reduce pending
        if (bookedChit.pendingAmount > 0) {
          const oldPending = bookedChit.pendingAmount;
          const payingTowardsPending = Math.min(amount, oldPending);
          pendingInc -= payingTowardsPending;
          
          // If payment exceeds old pending, the excess goes towards today's daily amount
          const excessAmount = amount - payingTowardsPending;
          if (excessAmount > 0 && excessAmount < bookedChit.dailyAmount) {
            // Still short of daily amount, add remaining to pending
            pendingInc += (bookedChit.dailyAmount - excessAmount);
          }
        } else {
          // No old pending, just calculate for today's daily amount
          if (amount < bookedChit.dailyAmount) {
            pendingInc += (bookedChit.dailyAmount - amount);
          }
        }
      } else {
        // First payment for this month
        const thisMonthPendingInc = bookedChit.dailyAmount - amount;
        pendingInc += thisMonthPendingInc;
      }
    } else if (status === "due") {
      pendingInc += bookedChit.dailyAmount;
    }

    update.$inc.pendingAmount = pendingInc;

    const entryPayment = await BookedChit.findByIdAndUpdate(bookedChit._id, update, { new: true });

    // Check and update status based on lastDate and pendingAmount
    await validateAndUpdateStatus(bookedChit._id);

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

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const editPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status } = req.body;

    // Validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (!["paid", "due"].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "paid" or "due"' });
    }

    // Find the booked chit
    const bookedChit = await BookedChit.findById(id).populate("userId");
    if (!bookedChit) {
      return res.status(404).json({ message: "Booked Chit not found" });
    }

    // Check if there are any payments
    if (!bookedChit.payments || bookedChit.payments.length === 0) {
      return res.status(400).json({ message: "No payments found to edit" });
    }

    // Get the last payment
    const lastPayment = bookedChit.payments[bookedChit.payments.length - 1];
    const originalAmount = lastPayment.amount;
    const originalStatus = lastPayment.status;

    // Check if amount is unchanged
    if (amount === originalAmount && status === originalStatus) {
      return res.status(400).json({ message: "No changes detected" });
    }

    const chitGroup = await ChitGroup.findById(bookedChit.chitId);
    if (!chitGroup) {
      return res.status(404).json({ message: "Chit Group not found" });
    }

    // Calculate the difference
    const amountDifference = amount - originalAmount;

    // Prepare update object
    const update = {
      $set: {
        [`payments.${bookedChit.payments.length - 1}.amount`]: amount,
        [`payments.${bookedChit.payments.length - 1}.status`]: status,
      },
      $inc: {}
    };

    // Update collectedAmount and pendingAmount based on status changes
    if (originalStatus === "paid" && status === "paid") {
      // Both paid: just adjust collectedAmount and pendingAmount by difference
      update.$inc.collectedAmount = amountDifference;
      update.$inc.pendingAmount = -amountDifference;
    } else if (originalStatus === "paid" && status === "due") {
      // Changed from paid to due: reverse the paid amount
      update.$inc.collectedAmount = -originalAmount;
      update.$inc.pendingAmount = originalAmount;
    } else if (originalStatus === "due" && status === "paid") {
      // Changed from due to paid: add to collected, remove from pending
      update.$inc.collectedAmount = amount;
      update.$inc.pendingAmount = -amount;
    } else if (originalStatus === "due" && status === "due") {
      // Both due: adjust pendingAmount by difference
      update.$inc.pendingAmount = amountDifference;
    }

    // Update the booked chit
    const updatedChit = await BookedChit.findByIdAndUpdate(
      bookedChit._id,
      update,
      { new: true }
    ).populate("userId");

    // Send push notification if status or significant change
    const user = bookedChit.userId;
    if (user?.expoPushToken) {
      const title = "Payment Updated";
      const body = `Your payment has been updated to ₹${amount} (${status})`;

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
                month: lastPayment.monthIndex,
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
      message: "Payment updated successfully",
      data: { updatedChit },
    });

  } catch (error) {
    console.error("Error editing payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}