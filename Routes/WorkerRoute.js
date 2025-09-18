import express from 'express';
import { NewRoute } from '../Controller/WorkerRouteController.js';

const router = express.Router();

router.post('/newroute', NewRoute);



export default router;
