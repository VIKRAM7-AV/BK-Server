import mongoose from "mongoose";

const chitGroupSchema = new mongoose.Schema({
  groupCode: { type: String, required: true, unique: true },
  chitValue: { type: Number, required: true },              
  durationMonths: { type: Number, required: true },          
  monthlyContribution: { type: Number, required: true },
  dailyContribution: { type: Number },

  totalDueAmount: { type: Number, required: true },
  totalDividend: { type: Number, required: true },

  auctionTable: [
    {
      month: Number,
      dividend: Number,
      dueAmount: Number,
      bidAmount: Number,
      payment: Number
    }
  ]
});

export default mongoose.model("ChitGroup", chitGroupSchema);
