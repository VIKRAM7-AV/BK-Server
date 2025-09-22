import express from "express";
import { NewAgent,SetPin,LoginAgent,RefreshTokenCon,TokenPush, ForgetPin, Getme } from "../Controller/AgentController.js";
import { authenticateAgent } from "../Middleware/UserMiddle.js";

const router = express.Router();


router.post("/newagent", NewAgent);
router.post("/setpin", SetPin);
router.post("/forgetpin", ForgetPin);
router.post("/login", LoginAgent);
router.get("/me",authenticateAgent,Getme)
router.post("/refreshtoken", RefreshTokenCon);
router.post("/save-token", TokenPush);






export default router;