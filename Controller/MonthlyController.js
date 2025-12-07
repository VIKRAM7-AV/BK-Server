import MonthlyCollection from "../Model/MonthlyCollectionModel.js";
import { getCurrentChitMonthRange } from "../utils/getCurrentChitMonthRange.js";
import { BookedChit } from "../Model/BookedChit.js";
import User from "../Model/UserModel.js";


export const addMonthlyPayment = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { agentId, amount, status } = req.body;
    const { startDate, endDate } = getCurrentChitMonthRange();

    let monthlyCollection = await MonthlyCollection.findOne({ agentId });

    if (!monthlyCollection) {
      monthlyCollection = new MonthlyCollection({ agentId, months: [] });
    }

    // Check if current chit-month exists
    let month = monthlyCollection.months.find(
      m => m.startDate.getTime() === startDate.getTime()
    );

    if (!month) {
      // create new month entry
      monthlyCollection.months.push({
        startDate,
        endDate,
        payments: []
      });
      month = monthlyCollection.months[monthlyCollection.months.length - 1];
    }

    // Push payment
    month.payments.push({ bookedChit, amount, status });

    // If status is "paid" and amount is less than monthlyAmount, update dueAmount
    if (status === "paid") {
      const bookedChitData = await BookedChit.findById(bookedChit);
      
      if (bookedChitData && bookedChitData.monthlyAmount > amount) {
        const balanceDue = bookedChitData.monthlyAmount - amount;
        month.dueAmount += balanceDue;
      }
    }

    if (status === "due") {
      month.dueAmount += amount;
    }

    // Save
    await monthlyCollection.save();

    res.status(200).json(monthlyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const GetMonthlyCollection = async (req, res) => {
  try {
    const { agentId } = req.params; 

    const monthlyCollection = await MonthlyCollection.findOne({ agentId }).populate({
      path: "months.payments.bookedChit",   // nested populate
      model: 'BookedChit', // Explicitly specify the model to override ref mismatch
      populate: { 
        path: "userId",
        model: 'User' // Specify model if needed, but ref should handle it
      }        
    });

    if (!monthlyCollection) {
      return res.status(404).json({ message: "Monthly collection not found" });
    }

    res.status(200).json(monthlyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const EditMonthlyPayment = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { agentId, amount, status } = req.body;

    // Validation
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    if (!["paid", "due"].includes(status)) {
      return res.status(400).json({ message: 'Status must be either "paid" or "due"' });
    }

    const { startDate, endDate } = getCurrentChitMonthRange();

    // Find MonthlyCollection for the agent
    const monthlyCollection = await MonthlyCollection.findOne({ agentId });

    if (!monthlyCollection) {
      return res.status(404).json({ message: "Monthly collection not found for this agent" });
    }

    // Find current month entry
    const currentMonth = monthlyCollection.months.find(
      m => m.startDate.getTime() === startDate.getTime()
    );

    if (!currentMonth) {
      return res.status(404).json({ message: "No collection found for current month" });
    }

    // Find the LAST payment for this bookedChit in current month's payments
    let paymentIndex = -1;
    for (let i = currentMonth.payments.length - 1; i >= 0; i--) {
      if (currentMonth.payments[i].bookedChit.toString() === bookedChit) {
        paymentIndex = i;
        break;
      }
    }

    if (paymentIndex === -1) {
      return res.status(404).json({ message: "Payment not found in current month's collection" });
    }

    // Get the original payment and booked chit data
    const originalPayment = currentMonth.payments[paymentIndex];
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
    if (originalStatus === "paid" && originalAmount < bookedChitData.monthlyAmount) {
      oldDueContribution = bookedChitData.monthlyAmount - originalAmount;
    } else if (originalStatus === "due") {
      oldDueContribution = originalAmount;
    }

    // Calculate new due contribution
    let newDueContribution = 0;
    if (status === "paid" && amount < bookedChitData.monthlyAmount) {
      newDueContribution = bookedChitData.monthlyAmount - amount;
    } else if (status === "due") {
      newDueContribution = amount;
    }

    // Adjust dueAmount manually
    const dueAmountDifference = newDueContribution - oldDueContribution;
    currentMonth.dueAmount += dueAmountDifference;

    // Update the payment (only the last entry)
    currentMonth.payments[paymentIndex].amount = amount;
    currentMonth.payments[paymentIndex].status = status;

    // Save the document (pre-save hook will recalculate totalAmount)
    await monthlyCollection.save();

    res.status(200).json({
      message: "Payment updated successfully in monthly collection",
      data: monthlyCollection,
    });
  } catch (error) {
    console.error("Error editing monthly payment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};