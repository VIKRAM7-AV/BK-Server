
import User from "../Model/UserModel.js";
import Notification from "../Model/notification.js";


export const GetNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json({ notifications });        
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
        console.error("Error fetching notifications:", error);        
    }
}

export const DelNotification = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedNotification = await Notification.findByIdAndDelete(id);
        if (!deletedNotification) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.status(200).json({ message: "Notification deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
        console.error("Error deleting notification:", error);
    }
}