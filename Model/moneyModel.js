import mongoose from 'mongoose';

const moneySchema = new mongoose.Schema({
    lastMonthDue:{type:Number,default:0},
    currentMonthDue:{type:Number,default:0},
    totalCollected:{type:Number,default:0},
    balanceAmount:{type:Number,default:0},
},{timestamps:true})

const Money = mongoose.model('Money', moneySchema);

export default Money;