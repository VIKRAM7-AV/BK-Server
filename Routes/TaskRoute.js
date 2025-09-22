import express from "express";
import { CreateTask, GetTasks } from "../Controller/TaskController.js";

const router = express.Router();

router.post("/create", CreateTask);
router.get("/agenttask", GetTasks);



export default router;