import express from 'express';
import { NewEnquiry, ChitExitFn , CompanyExitFn, VacantChitBookingFn} from '../Controller/EnquiryController.js';

const router = express.Router();

router.post('/newenquiry', NewEnquiry);
router.post('/exitchit', ChitExitFn);
router.post('/exitcompany', CompanyExitFn);
router.post('/vacantchitbooking/:openchit', VacantChitBookingFn);

export default router;