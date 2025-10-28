import mongoose from 'mongoose';

const auctionDataSchema = new mongoose.Schema({
    auctionId: {type:mongoose.Schema.Types.ObjectId, ref:'Auction'},
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    reason: { type: String },
    status: { type: String, enum: ['pending', 'complete'], default: 'pending' }
}, { timestamps: true });

const AuctionData = mongoose.model('AuctionData', auctionDataSchema);

const userAuctionDataSchema = new mongoose.Schema({
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auctionId: {type:mongoose.Schema.Types.ObjectId, ref:'Auction'},
    reason: { type: String },
    date: { type: Date, required: true },
    amount: { type: Number, required: true },
    title: { type: String },
    description: { type: String },
    status: { type: String, enum: ['pending', 'rejected', 'approved'], default: 'pending' },
    view: { type: Boolean, default: false }
}, { timestamps: true });

const UserAuctionData = mongoose.model('UserAuctionData', userAuctionDataSchema);

export { AuctionData, UserAuctionData };