import express from "express";
import { addMonthlyPayment, GetMonthlyCollection } from "../Controller/MonthlyController.js";


const router = express.Router();

router.post("/payment/:bookedChit", addMonthlyPayment);
router.get("/:agentId", GetMonthlyCollection);

export default router;
