import express from "express";

import { CreateDailyCollection } from "../Controller/DailyController.js";

const router = express.Router();

router.post("/payment/:bookedChit", CreateDailyCollection);

export default router;
