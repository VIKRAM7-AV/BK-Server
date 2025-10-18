import express from 'express';
import { NewEnquiry, ChitExitFn , CompanyExitFn, VacantChitBookingFn, getAgentNotifications, markNotificationAsViewed} from '../Controller/EnquiryController.js';

const router = express.Router();

router.post('/newenquiry', NewEnquiry);
router.post('/exitchit', ChitExitFn);
router.post('/exitcompany', CompanyExitFn);
router.post('/vacantchitbooking/:openchit', VacantChitBookingFn);
router.get('/notifications/:agentId', getAgentNotifications);
router.post('/notifications/mark-as-viewed', markNotificationAsViewed);

export default router;