import express from "express";
import { GetNotifications, DelNotification, GetNotificationAgent, DelNotificationAgent } from "../Controller/NotificationController.js";


const router = express.Router();


router.get("/notifications/:userId", GetNotifications);
router.delete("/delnotification/:id", DelNotification);
router.get("/agent/notifications/:agentId", GetNotificationAgent);
router.delete("/agent/delnotification/:id", DelNotificationAgent);


export default router;