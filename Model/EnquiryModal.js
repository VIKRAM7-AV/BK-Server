import mongoose from "mongoose";

const enquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: Number, required: true },
    chitPlan: { type: String, required: true },
    duration:{ type: String, required: true },
    message: { type: String },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    title: { type: String },
    description: { type: String },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    view: { type: Boolean, default: false }
}, { timestamps: true });

const Enquiry = mongoose.model("Enquiry", enquirySchema);

const chitExitSchema = new mongoose.Schema({
    agentId:{type:mongoose.Schema.Types.ObjectId, ref:'Agent'},
    bookedchit:{type:mongoose.Schema.Types.ObjectId, ref:'BookedChit'},
    title:{type:String},
    description:{type:String},
    status:{type:String, enum:['pending','approved','rejected'], default:'pending'},
    view:{type:Boolean, default:false}
},{ timestamps: true });

const ChitExit = mongoose.model("ChitExit", chitExitSchema);

const exitCompanySchema = new mongoose.Schema({
    agentId:{type:mongoose.Schema.Types.ObjectId, ref:'Agent'},
    userId:{type:mongoose.Schema.Types.ObjectId, ref:'User'},
    title:{type:String},
    description:{type:String},
    status:{type:String, enum:['pending','approved','rejected'], default:'pending'},
    view:{type:Boolean, default:false}
},{ timestamps: true });

const ExitCompany = mongoose.model("ExitCompany", exitCompanySchema);

const OpenChitSchema = new mongoose.Schema({
    agentId:{type:mongoose.Schema.Types.ObjectId, ref:'Agent'},
    openchit:{type:mongoose.Schema.Types.ObjectId, ref:'VacantChit'},
    userId:{type:mongoose.Schema.Types.ObjectId, ref:'User'},
    title:{type:String},
    description:{type:String},
    status:{type:String, enum:['pending','approved','rejected'], default:'pending'},
    view:{type:Boolean, default:false}
},{ timestamps: true });

const OpenChit = mongoose.model("OpenChit", OpenChitSchema);

export { Enquiry, ChitExit, ExitCompany, OpenChit };
