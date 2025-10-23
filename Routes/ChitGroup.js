import express from "express";
import {ChitGroupController,AllChitGroup,UserChits,BookingChit,monthlypayment,dailypayment, ArrearPayment, rejectChitExit, approveChitExit} from "../Controller/ChitGroupController.js";

const router= express.Router();

router.post("/create", ChitGroupController);
router.get("/", AllChitGroup);
router.get("/:id", UserChits);
router.post("/chits/:id", BookingChit);
router.post("/monthlypayment/:id", monthlypayment);
router.post("/dailypayment/:id", dailypayment);
router.post("/arrearpayment/:id", ArrearPayment);
router.post("/rejectchitexit/:id", rejectChitExit);
router.post("/approvechitexit/:id", approveChitExit);


export default router;