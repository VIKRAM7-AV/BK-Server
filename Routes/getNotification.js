import express from "express";
import { GetNotifications, DelNotification } from "../Controller/NotificationController.js";


const router = express.Router();


router.get("/notifications/:userId", GetNotifications);
router.delete("/delnotification/:id", DelNotification);

export default router;