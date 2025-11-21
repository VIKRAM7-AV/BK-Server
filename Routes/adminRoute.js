import express from 'express';
import { verifyToken } from "../utils/jwt.js";
import { LoginAdmin, RefreshTokenCon, Getme, NewAdmin, getallUsers,ResetPassword,AllAgents, getdailyChitusers, getdailyChitusersReport,SendOTP, VerifyOTP, getmonthlyChitusers, getmonthlyChitusersReport, GetCountUsers, DueList, ArrearList } from '../Controller/AdminController.js';

export const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ success: false, message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = verifyToken(token);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};

const router = express.Router();

router.post("/login", LoginAdmin);
router.post("/newadmin", NewAdmin);
router.post("/refresh-token", RefreshTokenCon);
router.get("/me", authenticateAdmin, Getme);
router.get('/allusers', getallUsers);
router.get('/dailychitusers', getdailyChitusers);
router.get('/dailychitusersreport', getdailyChitusersReport);
router.get('/monthlychitusers', getmonthlyChitusers);
router.get('/monthlychitusersreport', getmonthlyChitusersReport);
router.get('/dashboard', GetCountUsers)
router.post('/sendotp', SendOTP);
router.post('/verifyotp', VerifyOTP);
router.post('/resetpassword', ResetPassword);
router.get('/alldues', DueList)
router.get('/arrearlist',ArrearList)
router.get('/allagents',AllAgents)

export default router;