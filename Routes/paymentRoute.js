import express from 'express';
import {
  createPaymentOrder,
  verifyPaymentOrder,
  submitUpiReference,
  markPaymentSuccess,
  getUserPaymentHistory,
  getPendingPayments,
  cancelPaymentOrder
} from '../Controller/PaymentController.js';

const router = express.Router();

// User endpoints
router.post('/create-order', createPaymentOrder);
router.post('/verify-order', verifyPaymentOrder);
router.post('/submit-upi-ref', submitUpiReference);
router.post('/cancel', cancelPaymentOrder);
router.get('/history/:userId', getUserPaymentHistory);

// Admin endpoints
router.post('/mark-success', markPaymentSuccess);
router.get('/pending', getPendingPayments);

export default router;
