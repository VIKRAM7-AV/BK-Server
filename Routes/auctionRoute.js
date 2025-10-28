import express from 'express';
import { setauction, ModifyUserAuctionDate, rejectAuction, approveAuction } from '../Controller/AuctionController.js';

const router = express.Router();


router.post('/setauction/:auctionId', setauction);
router.post('/userauction/:auctionId', ModifyUserAuctionDate);
router.post('/rejectauction/:auctionId', rejectAuction);
router.post('/approveauction/:auctionId', approveAuction);

export default router;