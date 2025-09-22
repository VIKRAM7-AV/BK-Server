import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    Route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkerRoute",
      required: true,
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Agent",
        required: true,
    },
    ReassignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

const Task = mongoose.model("Task", taskSchema);

export default Task;
