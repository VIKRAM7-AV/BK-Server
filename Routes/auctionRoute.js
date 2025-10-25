import express from 'express';
import { setauction, ModifyUserAuctionDate } from '../Controller/AuctionController.js';

const router = express.Router();


router.post('/setauction/:auctionId', setauction);
router.post('/userauction/:auctionId', ModifyUserAuctionDate);

export default router;