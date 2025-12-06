import express from "express";

import { CreateDailyCollection,GetDailyCollection, EditDailyPayment  } from "../Controller/DailyController.js";

const router = express.Router();

router.post("/payment/:bookedChit", CreateDailyCollection);
router.post("/editpayment/:bookedChit", EditDailyPayment);
router.get("/:routeId", GetDailyCollection);

export default router;
