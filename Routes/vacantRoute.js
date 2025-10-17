import express from 'express';
import { VacantAdd,VacantList } from "../Controller/vacantController.js";

const router = express.Router();

router.post('/addvacant/:chitExit', VacantAdd);
router.get('/list', VacantList);
// router.delete('/deletevacant/:id', VacantDelete);

export default router;