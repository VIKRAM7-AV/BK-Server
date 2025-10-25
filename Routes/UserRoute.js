import express from "express";
import { SetPin, LoginCon, NewUser, LogoutCon, me, RefreshTokenCon, ForgetPin, ChangePin, TokenPush, approvedCompanyExit, rejectCompanyExit } from "../Controller/UserController.js";
import {authenticateUser} from "../Middleware/UserMiddle.js";
import multer from "multer";
const upload = multer({ dest: 'uploads/' });
const router = express.Router();


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
