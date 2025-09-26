import express from "express";
import {ChitGroupController,AllChitGroup,UserChits,BookingChit,monthlypayment,dailypayment} from "../Controller/ChitGroupController.js";

const router= express.Router();

router.post("/create", ChitGroupController);
router.get("/", AllChitGroup);
router.get("/:id", UserChits);
router.post("/chits/:id", BookingChit);
router.post("/monthlypayment/:id", monthlypayment);
router.post("/dailypayment/:id", dailypayment);

export default router;