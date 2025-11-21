import express from 'express';
import { setauction, ModifyUserAuctionDate, rejectAuction, approveAuction, AllRequests, setNewAuctionDate,AuctionHistory, FinalAuction, AuctionCommitments, UpcomingAuctionsMonthWise, UpdateAuctionCommitment, AuctionComplete } from '../Controller/AuctionController.js';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = express.Router();


router.post('/setauction/:auctionId', setauction);
router.post('/userauction/:auctionId', ModifyUserAuctionDate);
router.post('/rejectauction/:auctionId', rejectAuction);
router.post('/approveauction/:auctionId', approveAuction);
router.get('/auctionrequests', AllRequests);
router.put('/updateauctioncommitment/:id', UpdateAuctionCommitment);
router.put('/setnewauctiondate/:id', setNewAuctionDate);
router.post('/finalauction/:id', FinalAuction);
router.get('/auctioncommitments', AuctionCommitments);
router.post('/auctioncompleted/:id', upload.single('image'), AuctionComplete);
router.get('/upcomingauctions', UpcomingAuctionsMonthWise);
router.get('/auctionhistory', AuctionHistory);

export default router;