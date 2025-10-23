import mongoose from "mongoose";

const agentNotificationSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent"},
  title: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const AgentNotification = mongoose.model("AgentNotification", agentNotificationSchema);

export default AgentNotification;
