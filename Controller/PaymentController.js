import Payment from "../Model/PaymentModel.js";
import { BookedChit } from "../Model/BookedChit.js";
import User from "../Model/UserModel.js";
import ChitGroup from "../Model/ChitGroup.js";
import { v4 as uuidv4 } from 'uuid';
import { Expo } from 'expo-server-sdk';
import Notification from "../Model/notification.js";

const expo = new Expo();

/**
 * Create a new payment order
 * POST /api/payment/create-order
 */
export const createPaymentOrder = async (req, res) => {
  try {
    let { userId, chitId, chitGroupId, bookedChitId, amount, paymentType, metadata } = req.body;

    console.log('Create payment order request:', req.body);

    // Accept either chitId or chitGroupId
    chitId = chitId || chitGroupId;

    // Validate required fields
    if (!userId || !chitId || !amount) {
      console.log('Validation failed:', { userId: !!userId, chitId: !!chitId, amount: !!amount });
      return res.status(400).json({
        success: false,
        message: "userId, chitId (or chitGroupId), and amount are required",
        received: { userId: !!userId, chitId: !!chitId, amount: !!amount }
      });
    }

    // Set default paymentType if not provided
    if (!paymentType) {
      paymentType = 'MONTHLY'; // default to MONTHLY
    }

    // Validate amount
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0"
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Verify chit group exists
    const chitGroup = await ChitGroup.findById(chitId);
    if (!chitGroup) {
      return res.status(404).json({
        success: false,
        message: "Chit group not found"
      });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create payment order
    const payment = new Payment({
      orderId,
      userId,
      chitId,
      bookedChitId: bookedChitId || null,
      amount,
      paymentType,
      status: 'PENDING',
      metadata: metadata || {}
    });

    await payment.save();

    // Build UPI payment details
    const upiDetails = {
      pa: process.env.UPI_ID || 'merchant@upi',  // Your UPI ID from env
      pn: process.env.BUSINESS_NAME || 'BK Chit Fund',
      tr: orderId,  // Transaction reference
      tn: `${paymentType} Payment for ${chitGroup.groupCode}`,
      am: amount.toString(),
      cu: 'INR'
    };

    return res.status(201).json({
      success: true,
      message: "Payment order created successfully",
      data: {
        orderId,
        amount,
        paymentType,
        chitGroup: {
          id: chitGroup._id,
          groupCode: chitGroup.groupCode,
          chitValue: chitGroup.chitValue
        },
        upiDetails,
        status: 'PENDING'
      }
    });

  } catch (error) {
    console.error("Create payment order error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Verify payment status
 * POST /api/payment/verify-order
 */
export const verifyPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const payment = await Payment.findOne({ orderId })
      .populate('userId', 'name phone userId')
      .populate('chitId', 'groupCode chitValue');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found",
        status: 'NOT_FOUND'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        paymentType: payment.paymentType,
        upiTransactionId: payment.upiTransactionId,
        upiTransactionRef: payment.upiTransactionRef,
        createdAt: payment.createdAt,
        verifiedAt: payment.verifiedAt,
        user: payment.userId,
        chitGroup: payment.chitId
      }
    });

  } catch (error) {
    console.error("Verify payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Submit UPI transaction reference (manual verification by user)
 * POST /api/payment/submit-upi-ref
 */
export const submitUpiReference = async (req, res) => {
  try {
    const { orderId, upiTransactionId, upiTransactionRef, payerVPA } = req.body;

    if (!orderId || !upiTransactionId) {
      return res.status(400).json({
        success: false,
        message: "orderId and upiTransactionId are required"
      });
    }

    const payment = await Payment.findOne({ orderId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found"
      });
    }

    if (payment.status === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: "Payment already verified and completed"
      });
    }

    // Update payment with UPI details (pending admin verification)
    payment.upiTransactionId = upiTransactionId;
    payment.upiTransactionRef = upiTransactionRef || null;
    payment.payerVPA = payerVPA || null;
    payment.status = 'PENDING'; // Remains pending until admin verifies
    
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "UPI transaction reference submitted. Pending admin verification.",
      data: {
        orderId: payment.orderId,
        status: payment.status,
        upiTransactionId: payment.upiTransactionId
      }
    });

  } catch (error) {
    console.error("Submit UPI reference error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Admin: Mark payment as SUCCESS (manual verification)
 * POST /api/payment/mark-success
 */
export const markPaymentSuccess = async (req, res) => {
  try {
    const { orderId, upiTransactionId, verifiedBy } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const payment = await Payment.findOne({ orderId })
      .populate('userId', 'name phone expoPushToken')
      .populate('chitId', 'groupCode');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found"
      });
    }

    if (payment.status === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: "Payment already marked as success"
      });
    }

    // Update payment status
    payment.status = 'SUCCESS';
    payment.verifiedAt = new Date();
    payment.verifiedBy = verifiedBy || null;
    
    if (upiTransactionId) {
      payment.upiTransactionId = upiTransactionId;
    }

    await payment.save();

    // Update booked chit payment records if applicable
    if (payment.bookedChitId) {
      const bookedChit = await BookedChit.findById(payment.bookedChitId);
      if (bookedChit) {
        // Add payment to payments array
        bookedChit.payments.push({
          amount: payment.amount,
          date: new Date(),
          method: 'UPI',
          transactionId: payment.upiTransactionId || payment.orderId,
          status: 'completed'
        });

        // Update pending amount
        bookedChit.pendingAmount = Math.max(0, bookedChit.pendingAmount - payment.amount);
        
        await bookedChit.save();
      }
    }

    // Send push notification to user
    const user = payment.userId;
    if (user && user.expoPushToken && Expo.isExpoPushToken(user.expoPushToken)) {
      try {
        const message = {
          to: user.expoPushToken,
          sound: 'default',
          title: 'Payment Successful ✅',
          body: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} has been verified successfully.`,
          data: {
            orderId: payment.orderId,
            type: 'payment_success'
          }
        };

        const receipts = await expo.sendPushNotificationsAsync([message]);
        
        if (receipts[0].id) {
          await Notification.create({
            userId: user._id,
            title: 'Payment Successful',
            body: `Your payment of ₹${payment.amount.toLocaleString('en-IN')} has been verified successfully.`,
            notificationId: receipts[0].id
          });
        }
      } catch (notifError) {
        console.error('Error sending payment success notification:', notifError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment marked as success",
      data: {
        orderId: payment.orderId,
        amount: payment.amount,
        status: payment.status,
        verifiedAt: payment.verifiedAt
      }
    });

  } catch (error) {
    console.error("Mark payment success error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get user payment history
 * GET /api/payment/history/:userId
 */
export const getUserPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, limit = 50, skip = 0 } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const payments = await Payment.find(query)
      .populate('chitId', 'groupCode chitValue')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Payment.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > (parseInt(skip) + payments.length)
      }
    });

  } catch (error) {
    console.error("Get payment history error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get all pending payments (Admin)
 * GET /api/payment/pending
 */
export const getPendingPayments = async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;

    const payments = await Payment.find({ 
      status: 'PENDING',
      upiTransactionId: { $ne: null } // Only payments with UPI ref submitted
    })
      .populate('userId', 'name phone userId')
      .populate('chitId', 'groupCode chitValue')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await Payment.countDocuments({ 
      status: 'PENDING',
      upiTransactionId: { $ne: null }
    });

    return res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > (parseInt(skip) + payments.length)
      }
    });

  } catch (error) {
    console.error("Get pending payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Cancel payment order
 * POST /api/payment/cancel
 */
export const cancelPaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required"
      });
    }

    const payment = await Payment.findOne({ orderId });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment order not found"
      });
    }

    if (payment.status === 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel a successful payment"
      });
    }

    payment.status = 'CANCELLED';
    await payment.save();

    return res.status(200).json({
      success: true,
      message: "Payment order cancelled",
      data: {
        orderId: payment.orderId,
        status: payment.status
      }
    });

  } catch (error) {
    console.error("Cancel payment error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
