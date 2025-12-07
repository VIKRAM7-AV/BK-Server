import express from "express";
import { addMonthlyPayment, GetMonthlyCollection, EditMonthlyPayment } from "../Controller/MonthlyController.js";


const router = express.Router();

router.post("/payment/:bookedChit", addMonthlyPayment);
router.post("/editpayment/:bookedChit", EditMonthlyPayment);
router.get("/:agentId", GetMonthlyCollection);

export default router;
