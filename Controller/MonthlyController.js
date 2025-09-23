import MonthlyCollection from "../Model/MonthlyCollectionModel.js";
import { getCurrentChitMonthRange } from "../utils/getCurrentChitMonthRange.js";

export const addMonthlyPayment = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { agentId, amount, status, method } = req.body;
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
    month.payments.push({ bookedChit, amount, status, method });

    // Save
    await monthlyCollection.save();

    res.status(200).json(monthlyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
