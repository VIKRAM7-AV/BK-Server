import express from 'express';
import { NewRoute, AllRoute, AllRouteAgent, UpdateRoute } from '../Controller/WorkerRouteController.js';

const router = express.Router();

router.post('/newroute', NewRoute);
router.get('/allroutes', AllRoute);
router.get('/adminroute', AllRouteAgent);
router.put("/updateroute/:id", UpdateRoute);


export default router;
