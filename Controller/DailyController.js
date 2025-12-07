import DailyCollection from "../Model/DailyCollectionModel.js";
import { BookedChit } from "../Model/BookedChit.js";

export const CreateDailyCollection = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { agentId, routeId, amount, status } = req.body;

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // 1️⃣ Find DailyCollection for the route
    let dailyCollection = await DailyCollection.findOne({ routeId });

    // 2️⃣ If it doesn't exist, create it
    if (!dailyCollection) {
      dailyCollection = new DailyCollection({ routeId, days: [] });
    }

    // 3️⃣ Check if today already exists in days[]
    let todayDay = dailyCollection.days.find(
      (d) => d.date >= startOfDay && d.date <= endOfDay
    );

    if (!todayDay) {
      // create today as Mongoose subdoc
      dailyCollection.days.push({
        date: new Date(),
        agentId,
        payments: [],
      });
      todayDay = dailyCollection.days[dailyCollection.days.length - 1];
    }

    // 4️⃣ Push payment into todayDay.payments
    todayDay.payments.push({ bookedChit, amount, status });

    // 5️⃣ If status is "paid" and amount is less than dailyAmount, update dueAmount
    if (status === "paid") {
      const bookedChitData = await BookedChit.findById(bookedChit);
      
      if (bookedChitData && bookedChitData.dailyAmount > amount) {
        const balanceDue = bookedChitData.dailyAmount - amount;
        todayDay.dueAmount += balanceDue;
      }
    }

    if (status === "due") {
      todayDay.dueAmount += amount;
    }

    // 6️⃣ Save the document
    await dailyCollection.save();

    res.status(200).json(dailyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const GetDailyCollection = async (req, res) => {
  try {
    const { routeId } = req.params;

    const dailyCollection = await DailyCollection.findOne({ routeId }).populate({
      path: "days.payments.bookedChit",   // nested populate
      populate: { path: "userId" }        // populate inside bookedChit
    });

    if (!dailyCollection) {
      return res.status(404).json({ message: "Daily collection not found" });
    }

    res.status(200).json(dailyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const EditDailyPayment = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { routeId, amount, status } = req.body;

    // Validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (!["paid", "due"].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "paid" or "due"' });
    }

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Find DailyCollection for the route
    const dailyCollection = await DailyCollection.findOne({ routeId });

    if (!dailyCollection) {
      return res.status(404).json({ message: "Daily collection not found for this route" });
    }

    // Find today's day entry
    const todayDay = dailyCollection.days.find(
      (d) => d.date >= startOfDay && d.date <= endOfDay
    );

    if (!todayDay) {
      return res.status(404).json({ message: "No collection found for today" });
    }

    // Find the LAST payment for this bookedChit in today's payments
    let paymentIndex = -1;
    for (let i = todayDay.payments.length - 1; i >= 0; i--) {
      if (todayDay.payments[i].bookedChit.toString() === bookedChit) {
        paymentIndex = i;
        break;
      }
    }

    if (paymentIndex === -1) {
      return res.status(404).json({ message: "Payment not found in today's collection" });
    }

    // Get the original payment and booked chit data
    const originalPayment = todayDay.payments[paymentIndex];
    const originalAmount = originalPayment.amount;
    const originalStatus = originalPayment.status;

    // Check if values are unchanged
    if (originalAmount === amount && originalStatus === status) {
      return res.status(400).json({ message: "No changes detected" });
    }

    // Get booked chit to calculate due amount properly
    const bookedChitData = await BookedChit.findById(bookedChit);
    if (!bookedChitData) {
      return res.status(404).json({ message: "Booked Chit not found" });
    }

    // Calculate old due contribution
    let oldDueContribution = 0;
    if (originalStatus === "paid" && originalAmount < bookedChitData.dailyAmount) {
      oldDueContribution = bookedChitData.dailyAmount - originalAmount;
    } else if (originalStatus === "due") {
      oldDueContribution = originalAmount;
    }

    // Calculate new due contribution
    let newDueContribution = 0;
    if (status === "paid" && amount < bookedChitData.dailyAmount) {
      newDueContribution = bookedChitData.dailyAmount - amount;
    } else if (status === "due") {
      newDueContribution = amount;
    }

    // Adjust dueAmount manually
    const dueAmountDifference = newDueContribution - oldDueContribution;
    todayDay.dueAmount += dueAmountDifference;

    // Update the payment (only the last entry)
    todayDay.payments[paymentIndex].amount = amount;
    todayDay.payments[paymentIndex].status = status;

    // Save the document (pre-save hook will recalculate totalAmount)
    await dailyCollection.save();

    res.status(200).json({
      message: "Payment updated successfully in daily collection",
      data: dailyCollection,
    });
  } catch (error) {
    console.error("Error editing daily payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
