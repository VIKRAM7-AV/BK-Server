import express from "express";
import { NewAgent,SetPin,LoginAgent,RefreshTokenCon,TokenPush, ForgetPin, Getme,DailyChits, getallUsers, getAllAgents, MonthlyChits, getBookedChitDetails, ChangePin, ArrearDailyChits, ArrearMonthlyChits } from "../Controller/AgentController.js";
import { authenticateAgent } from "../Middleware/UserMiddle.js";

const router = express.Router();


router.post("/newagent", NewAgent);
router.post("/setpin", SetPin);
router.post("/changepin", ChangePin);
router.post("/forgetpin", ForgetPin);
router.post("/login", LoginAgent);
router.get("/me",authenticateAgent,Getme)
router.post("/refreshtoken", RefreshTokenCon);
router.post("/save-token", TokenPush);
router.get('/dailychits/:agentId', DailyChits);
router.get('/allusers', getallUsers);
router.get('/monthlychits/:agentId', MonthlyChits);
router.get("/chitdetails", getBookedChitDetails);
router.get("/allagents", getAllAgents);
router.get("/arreardaily/:agentId", ArrearDailyChits);
router.get("/arrearmonthly/:agentId", ArrearMonthlyChits);


export default router;