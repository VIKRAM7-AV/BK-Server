import User from '../Model/UserModel.js';

const getAuctionTableEntry = async (userId, chitId, month) => {
  try {
    // Assuming you already fetched the user document
    // For example, you might have:
    // const user = await UserModel.findById(userId).populate('chits.chitId');

    const user = await User.findById(userId).populate('chits.chitId');

    if (!user) return null;

    // Find the chit inside user.chits
    const chitData = user.chits.find(c => String(c.chitId._id) === String(chitId));
    console.log("chitData:", chitData);
    console.log("user.chits:", user.chits.map(c => c.chitId._id));
    console.log("chitId:", chitId);
    if (!chitData) return null;

    // Find the month entry inside chitId.auctionTable
    const entry = chitData.chitId.auctionTable.find(
      e => Number(e.month) === Number(month)
    );

    if (!entry) return null;

    return entry;
  } catch (error) {
    console.error('Error in getAuctionTableEntry:', error);
    return null;
  }
};

export default getAuctionTableEntry;
