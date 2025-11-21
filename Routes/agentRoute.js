import express from "express";
import { NewAgent,SetPin,LoginAgent,RefreshTokenCon,TokenPush, ForgetPin, Getme,DailyChits, getallUsers, getAllAgents, MonthlyChits, getBookedChitDetails, ChangePin, ArrearDailyChits, ArrearMonthlyChits, updateAgent } from "../Controller/AgentController.js";
import { verifyToken } from "../utils/jwt.js";
import multer from "multer";

const upload = multer({ dest: 'uploads/' });

// Inlined authenticateAgent middleware to avoid external module path/case issues during deploy
export const authenticateAgent = (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ success: false, message: "No token provided" });
	}
	const token = authHeader.split(" ")[1];
	try {
		const decoded = verifyToken(token);
		req.agent = decoded;
		next();
	} catch (err) {
		return res.status(401).json({ success: false, message: "Invalid or expired token" });
	}
};

const router = express.Router();


router.post("/newagent", upload.single('image'), NewAgent);
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
router.put('/updateagent/:id', upload.single('image'), updateAgent);


export default router;