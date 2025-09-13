import express from 'express';
import { NewEnquiry } from '../Controller/EnquiryController.js';

const router = express.Router();

router.post('/newenquiry', NewEnquiry);

export default router;