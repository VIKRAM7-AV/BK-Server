import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema({
  payment: {
    type:Number,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  chitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChitGroup",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "complete", "cancel"],
    default: "pending",
  },
  auctionDate: {
    type: Date
  },
  cheque: {
    type: String
  },
  chequeImage: {
    type: String
  }
}, { timestamps: true });

const Auction = mongoose.model("Auction", auctionSchema);



const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    monthIndex: { type: Number },
    status: { type: String, enum: ["paid", "due", "pending"], default: "pending" },
  },
  { _id: false }
);


const bookedChitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChitGroup",
      required: true,
    },
    GroupUserId: {
      type: String,
      unique: true,
      required: true,
    },
    bookingType: { type: String, enum: ["daily", "monthly"], required: true },
    collectedAmount: { type: Number, default: 0 },
    pendingAmount: { type: Number, default: 0 },
    monthlyAmount: { type: Number, required: true },
    dailyAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["active", "completed", "closed", "arrear"],
      default: "active",
    },
    PenaltyAmount: { type: Number, default: 0 },
    month: { type: Date, required: true },
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true
    },

    payments: [paymentSchema],
    lastDueAddedMonth: { type: Number, default: 0 }
  },
  { timestamps: true }
);

bookedChitSchema.virtual("dueAmount").get(function () {
  return this.monthlyAmount - this.collectedAmount;
});

const BookedChit = mongoose.model("BookedChit", bookedChitSchema);

export { BookedChit, Auction };
