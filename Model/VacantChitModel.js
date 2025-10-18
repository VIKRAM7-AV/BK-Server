import mongoose from 'mongoose';

const vacantChitSchema = new mongoose.Schema({
    creater: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    chitplan: { type: mongoose.Schema.Types.ObjectId, ref: 'ChitPlan' },
    duration: { type: Number, required: true },
    collectedAmount: { type: Number, required: true },
    pendingAmount: { type: Number, required: true },
    status: { type: String, enum: ['active', 'closed','booked'], default: 'active' },
    view: { type: Boolean, default: false }
}, { timestamps: true });

const VacantChit = mongoose.model("VacantChit", vacantChitSchema);

export default VacantChit;
