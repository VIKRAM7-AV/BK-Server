import express from "express";

import { CreateDailyCollection,GetDailyCollection  } from "../Controller/DailyController.js";

const router = express.Router();

router.post("/payment/:bookedChit", CreateDailyCollection);
router.get("/:routeId", GetDailyCollection);

export default router;
