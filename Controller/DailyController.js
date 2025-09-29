import DailyCollection from "../Model/DailyCollectionModel.js";

export const CreateDailyCollection = async (req, res) => {
  try {
    const { bookedChit } = req.params;
    const { agentId, routeId, amount, status, method } = req.body;

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
    todayDay.payments.push({ bookedChit, amount, status, method });

    // 5️⃣ Save the document
    await dailyCollection.save();

    res.status(200).json(dailyCollection);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




