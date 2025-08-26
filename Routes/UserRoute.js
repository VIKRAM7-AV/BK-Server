import express from "express";
import { SetPin,LoginCon,NewUser,LogoutCon } from "../Controller/UserController.js";

const router = express.Router();

router.post("/setpin", SetPin);
router.post("/login", LoginCon);
router.post("/logout", LogoutCon);
router.post("/newuser", NewUser);

export default router;
