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