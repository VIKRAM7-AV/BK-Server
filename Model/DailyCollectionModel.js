import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  bookedChit: { type: mongoose.Schema.Types.ObjectId, ref: "BookedChit", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["paid", "due"], required: true }
}, { _id: false });

const DayCollectionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  totalAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  payments: [PaymentSchema]
}, { _id: false });

const DailyCollectionSchema = new mongoose.Schema({
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "WorkerRoute", required: true },
  days: [DayCollectionSchema]      
});


DayCollectionSchema.pre("save", function (next) {
  this.totalAmount = this.payments.reduce((sum, payment) => {
    return payment.status === "paid" ? sum + payment.amount : sum;
  }, 0);

  // Only calculate dueAmount from payments with status "due"
  const paymentDueAmount = this.payments.reduce((sum, payment) => {
    return payment.status === "due" ? sum + payment.amount : sum;
  }, 0);

  // Preserve manually added dueAmount if it's greater than payment-based calculation
  if (this.dueAmount < paymentDueAmount) {
    this.dueAmount = paymentDueAmount;
  }

  next();
});


const DailyCollection = mongoose.model("DailyCollection", DailyCollectionSchema);
export default DailyCollection;
