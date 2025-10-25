import express from "express";
import { SetPin, LoginCon, NewUser, LogoutCon, me, RefreshTokenCon, ForgetPin, ChangePin, TokenPush, approvedCompanyExit, rejectCompanyExit } from "../Controller/UserController.js";
import { verifyToken } from "../utils/jwt.js";
import multer from "multer";
const upload = multer({ dest: 'uploads/' });
const router = express.Router();

// Inlined authenticateUser middleware to avoid external module path/case issues during deploy
export const authenticateUser = (req, res, next) => {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ success: false, message: "No token provided" });
	}
	const token = authHeader.split(" ")[1];
	try {
		const decoded = verifyToken(token);
		req.user = decoded;
		next();
	} catch (err) {
		return res.status(401).json({ success: false, message: "Invalid or expired token" });
	}
};


router.post("/setpin", SetPin);
router.post("/forgetpin", ForgetPin);
router.post("/changepin", ChangePin);
router.post("/login", LoginCon);
router.post("/refresh", RefreshTokenCon);
router.post("/logout", LogoutCon);
router.post('/newuser', upload.single('profile'), NewUser);
router.post('/token', TokenPush);
router.get("/me", authenticateUser, me);
router.post("/approved-company-exit/:id", approvedCompanyExit);
router.post("/reject-company-exit/:id", rejectCompanyExit);


export default router;
