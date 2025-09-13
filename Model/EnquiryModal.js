import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: Number, required: true },
    chitPlan: { type: String, required: true },
    duration:{ type: String, required: true },
    message: { type: String },
}, { timestamps: true });

const Enquiry = mongoose.model("Enquiry", enquirySchema);

export default Enquiry;
