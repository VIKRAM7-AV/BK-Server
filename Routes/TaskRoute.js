import express from "express";
import { CreateTask, GetTasks,todayTask } from "../Controller/TaskController.js";

const router = express.Router();

router.post("/create", CreateTask);
router.get("/agenttask", GetTasks);
router.post("/todaytask", todayTask);



export default router;