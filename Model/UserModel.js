import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});

const NomineeSchema = new mongoose.Schema({
  name: {
    type: String,
  },
  dob: {
    type: Date,
  },
  relation: {
    type: String,
  },
  permanentAddress: {
    type: String,
  },
  phone: {
    type: Number,
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
    profile: {
      type: String,
    },
    dob: {
      type: Date,
    },
    phone: {
      type: Number,
      required: true,
      unique: true,
    },
    occupation: {
      type: String,
    },
    monthlyIncome: {
      type: Number,
    },
    permanentAddress: {
      type: String,
    },
    occupationAddress: {
      type: String,
    },
    password: {
      type: String,
      default: "0000",
    },
    nominee: {
      type: NomineeSchema,
    },
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerRoute",
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
    },
    role: {
      type: String,
      default: "user",
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    expoPushToken: {
      type: String,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"]
      },
      coordinates: {
        type: [Number]
      }
    },
    locationImage: {
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

// Create geospatial index for location queries
UserSchema.index({ location: "2dsphere" });

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
  // Remove incomplete or invalid GeoJSON `location` objects so MongoDB geospatial
  // indexers don't encounter documents with a type but missing coordinates.
  if (this.location) {
    const coords = this.location.coordinates;
    const validCoords = Array.isArray(coords) && coords.length === 2 && coords.every(c => typeof c === 'number' && Number.isFinite(c));
    if (!validCoords) {
      this.location = undefined;
    } else {
      this.location.type = 'Point';
    }
  }

  next();
});


const User = mongoose.model("User", UserSchema);

export default User;
