import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});

const NomineeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  dob: {
    type: Date,
    required: true,
  },
  relation: {
    type: String,
    required: true,
  },
  permanentAddress: {
    type: String,
    required: true,
  },
  phone: {
    type: Number,
    required: true,
  },
});

const UserSchema = new mongoose.Schema(
  {
    userId: {
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
    occupation: {
      type: String,
      required: true,
    },
    monthlyIncome: {
      type: Number,
      required: true,
    },
    permanentAddress: {
      type: String,
      required: true,
    },
    occupationAddress: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      default: "0000",
    },
    nominee: {
      type: NomineeSchema,
      required: true,
    },
    route: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin","agent"],
      default: "user",
    },
    expoPushToken: {
      type: String,
    },
    chits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BookedChit",
        required: true
      },
    ],
    auction: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Auction",
        required: true
      }
    ]
  },
  {
    timestamps: true,
  }
);

const Counter = mongoose.model("Counter", counterSchema);

UserSchema.pre("save", async function (next) {
  if (!this.userId) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { _id: "userId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.userId = `BKCHT-${String(counter.seq).padStart(1)}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});


const User = mongoose.model("User", UserSchema);

export default User;
