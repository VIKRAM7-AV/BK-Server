import express from "express";
import { addMonthlyPayment } from "../Controller/MonthlyController.js";


const router = express.Router();

router.post("/payment/:bookedChit", addMonthlyPayment);

export default router;
