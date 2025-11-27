import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChitGroup',
    required: true
  },
  bookedChitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BookedChit'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  paymentType: {
    type: String,
    enum: ['MONTHLY', 'DAILY', 'ARREAR', 'AUCTION', 'INITIAL', 'UPI'],
    required: true
  },
  upiTransactionId: {
    type: String,
    default: null
  },
  upiTransactionRef: {
    type: String,
    default: null
  },
  payerVPA: {
    type: String,
    default: null
  },
  paymentNote: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Index for faster queries
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ chitId: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ upiTransactionId: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
