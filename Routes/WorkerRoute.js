import express from 'express';
import { NewRoute, AllRoute } from '../Controller/WorkerRouteController.js';

const router = express.Router();

router.post('/newroute', NewRoute);
router.get('/allroutes', AllRoute);



export default router;
