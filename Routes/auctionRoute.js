import express from 'express';
import { setauction } from '../Controller/AuctionController.js';

const router = express.Router();


router.post('/setauction/:auctionId', setauction);

export default router;