import User from "../Model/UserModel.js";
import bcrypt from 'bcrypt';
import getToken from "../Token/getToken.js";

export const SetPin = async (req, res) => {
    try {
        const { userId, phone } = req.body;
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.phone !== phone) {
            return res.status(400).json({ message: "Phone number mismatch" });
        }

        const { pin, rePin } = req.body;
        if (pin !== rePin) {
            return res.status(400).json({ message: "PINs do not match" });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPin = await bcrypt.hash(pin, salt);

        user.password = hashedPin;
        await user.save();
        res.status(200).json({ message: "PIN set successfully" });
    } catch (error) {
        console.error("Error setting PIN:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


export const LoginCon= async(req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid PIN" });
        }
        await getToken(user._id, res);
        res.status(200).json({ message: "Login successful" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

export const NewUser = async (req, res) => {
  try {
    const {
      name, dob, phone, occupation, monthlyIncome,
      permanentAddress, occupationAddress,route, agent, nominee
    } = req.body;

    // Basic validation
    if (!name || !dob || !phone || !occupation || !monthlyIncome || 
        !permanentAddress || !occupationAddress || !route || !agent || !nominee || !nominee.name || !nominee.dob ||
        !nominee.relation || !nominee.permanentAddress || !nominee.phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if phone already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already exists" });
    }

    // Create user
    const newUser = new User({
      name, dob, phone, occupation, monthlyIncome,
      permanentAddress, occupationAddress,
      route, agent, nominee
    });

    await getToken(newUser._id, res);
    const savedUser = await newUser.save();
    res.status(201).json({
      message: "User created successfully",
      userId: savedUser.userId
    });

  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


export const LogoutCon = async (req, res) => {
    try {
        res.clearCookie("token");
        res.status(200).json({ message: "Logout successful" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
