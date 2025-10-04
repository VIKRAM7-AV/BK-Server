import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  bookedChit: { type: mongoose.Schema.Types.ObjectId, ref: "BookedChit", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["Paid", "Due"], required: true }
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
    return payment.status === "Paid" ? sum + payment.amount : sum;
  }, 0);

  this.dueAmount = this.payments.reduce((sum, payment) => {
    return payment.status === "Due" ? sum + payment.amount : sum;
  }, 0);

  next();
});


const DailyCollection = mongoose.model("DailyCollection", DailyCollectionSchema);
export default DailyCollection;
