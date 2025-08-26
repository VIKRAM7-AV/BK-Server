import express from "express";
import {ChitGroupController,AllChitGroup} from "../Controller/ChitGroupController.js";

const router= express.Router();

router.post("/create", ChitGroupController);
router.get("/", AllChitGroup);

export default router;