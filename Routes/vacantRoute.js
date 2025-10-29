import express from 'express';
import { VacantAdd,VacantList,rejectNewVacantChit,approveVacantChit } from "../Controller/vacantController.js";

const router = express.Router();

router.post('/addvacant/:chitExit', VacantAdd);
router.get('/list', VacantList);
router.post('/reject/:id', rejectNewVacantChit);
router.post('/approve/:id', approveVacantChit);

export default router;