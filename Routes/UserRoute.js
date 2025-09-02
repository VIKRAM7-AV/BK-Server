import express from "express";
import { SetPin, LoginCon, NewUser, LogoutCon, me, RefreshTokenCon } from "../Controller/UserController.js";
import {authenticateUser} from "../Middleware/UserMiddle.js";
const router = express.Router();


router.post("/setpin", SetPin);
router.post("/login", LoginCon);
router.post("/refresh", RefreshTokenCon);
router.post("/logout", LogoutCon);
router.post("/newuser", NewUser);
router.get("/me", authenticateUser, me);

export default router;
