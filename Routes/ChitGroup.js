import express from "express";
import {ChitGroupController,AllChitGroup,UserChits,BookingChit,payment} from "../Controller/ChitGroupController.js";
import { authenticateAdmin } from "../Middleware/AdminMiddle.js";

const router= express.Router();

router.post("/create", ChitGroupController);
router.get("/", AllChitGroup);
router.get("/:id", UserChits);
router.post("/chits/:id", BookingChit);
router.post("/payment/:id", payment);

export default router;