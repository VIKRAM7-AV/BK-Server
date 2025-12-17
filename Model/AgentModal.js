import mongoose from "mongoose";

const counterAgentSchema = new mongoose.Schema({
  _id: String,
  seq: {
    type: Number,
    default: 0,
  },
});

const agentSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
    },
    profile: {
      type: String,
    },
    dob: {
      type: Date,
    },
    phone: {
      type: Number
    },
    permanentAddress: {
      type: String,
    },
    password: {
      type: String,
      default: "000000",
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerRoute",
    },
    role: {
      type: String,
      default: "agent",
    },
    expoPushToken: {
      type: String,
    },
    task: {
      type: String,
    },
    paymentEdit: {
      type: Boolean,
      default: false,
    },
    monthlyUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookedChit",
        default: [],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const CounterAgent = mongoose.model("CounterAgent", counterAgentSchema);

agentSchema.pre("save", async function (next) {
  if (this.isNew) {   // ✅ Only run for new documents
    try {
      const counterAgent = await CounterAgent.findOneAndUpdate(
        { _id: "agentId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      this.agentId = `BKAGT-${String(counterAgent.seq)}`; 
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const Agent = mongoose.model("Agent", agentSchema);

export default Agent;
