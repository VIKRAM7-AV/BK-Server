import jwt from "jsonwebtoken";
import User from "../Models/UserModel.js";

const UserMiddle=async(req,res,next) => {
    try {
        const Token=req.cookies.token;
        if(!Token){
            return res.status(401).json({error:"Not authorized, no token"});
        }
        const decoded=jwt.verify(Token, process.env.JWT_SECRET);
        if(!decoded){
            return res.status(401).json({error:"Not authorized, token failed"});
        }
        const user=await User.findOne({_id : decoded.id}).select("-password");
        if(!user){
            return res.status(401).json({error:"Not authorized, user not found"});
        }
        req.user=user; 
        next();        
    } catch (error) {
        console.log("Error in protectRoute middleware",error);
        res.status(500).json({error:"Internal server error for protect route"});
    }
}

export default UserMiddle;