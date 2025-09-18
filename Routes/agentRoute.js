import express from "express";
import { NewAgent } from "../Controller/AgentController.js";

const router = express.Router();


router.post("/newagent", NewAgent);





export default router;