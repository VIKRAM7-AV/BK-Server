import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  bookedChit: { type: mongoose.Schema.Types.ObjectId, ref: "bookedChit", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["Paid", "Due"], required: true },
  method: { type: String, enum: ["cash", "upi", "bank", "cheque","null"], default: "cash" },
  date: { type: Date, default: Date.now }
}, { _id: false });

const MonthCollectionSchema = new mongoose.Schema({
  startDate: { type: Date, required: true },  // 10th of month
  endDate: { type: Date, required: true },    // 9th of next month
  totalAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  payments: [PaymentSchema]
}, { _id: false });

const MonthlyCollectionSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  months: [MonthCollectionSchema]
});

// Auto calculate totals per month
MonthCollectionSchema.pre("save", function(next) {
  this.totalAmount = this.payments.reduce((sum, payment) => payment.status === "Paid" ? sum + payment.amount : sum, 0);
  this.dueAmount = this.payments.reduce((sum, payment) => payment.status === "Due" ? sum + payment.amount : sum, 0);
  next();
});

const MonthlyCollection = mongoose.model("MonthlyCollection", MonthlyCollectionSchema);
export default MonthlyCollection;
