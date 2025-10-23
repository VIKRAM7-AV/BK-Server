import express from 'express';
import { VacantAdd,VacantList,rejectNewVacantChit } from "../Controller/vacantController.js";

const router = express.Router();

router.post('/addvacant/:chitExit', VacantAdd);
router.get('/list', VacantList);
router.post('/reject/:id', rejectNewVacantChit);

export default router;