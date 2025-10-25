import mongoose from "mongoose";


const RouteSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});


const workerRouteSchema = new mongoose.Schema({
    place: {
        type: String,
        required: true,
    },
    DailyChit: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "BookedChit",
        default: []
    },
    routeId: {
        type: String,
        unique: true,
    }
},{ timestamps: true });

const routeCounter = mongoose.model("RouteCounter", RouteSchema);

workerRouteSchema.pre("save", async function (next) {
  if (!this.routeId) {
    try {
      const counter = await routeCounter.findOneAndUpdate(
        { _id: "routeId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.routeId = `Route ${String(counter.seq).padStart(1)}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

const WorkerRoute = mongoose.model("WorkerRoute", workerRouteSchema);

export default WorkerRoute;
