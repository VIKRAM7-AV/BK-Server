import express from "express";
import { CreateTask, GetTasks,todayTask,GetRoutes } from "../Controller/TaskController.js";

const router = express.Router();

router.post("/create", CreateTask);
router.post("/agenttask/:id", GetTasks);
router.post("/todaytask", todayTask);
router.get("/routes/:routeId", GetRoutes);



export default router;