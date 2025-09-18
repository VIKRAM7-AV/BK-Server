import mongoose from "mongoose";

const counterAgentSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});


const agentSchema = new mongoose.Schema(
  {
    agentId: {
      type: String,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    phone: {
      type: Number,
      required: true,
      unique: true,
    },
    permanentAddress: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      default: "0000",
    },
    route: {
      type: String,
    },
    role: {
      type: String,
      default: "agent",
    },
    expoPushToken: {
      type: String,
    },
   dailyUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookedChit",
        default: []
      },
    ],
    monthlyUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookedChit",
        default: []
      }
    ]
  },
  {
    timestamps: true,
  }
);

const CounterAgent = mongoose.model("CounterAgent", counterAgentSchema);

agentSchema.pre("save", async function (next) {
  if (!this.userId) {
    try {
      const counterAgent = await CounterAgent.findOneAndUpdate(
        { _id: "agentId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.agentId = `BKAGT-${String(counterAgent.seq).padStart(1)}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});


const Agent = mongoose.model("Agent", agentSchema);

export default Agent;
