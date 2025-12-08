import express from "express";
import multer from "multer";
import { SetPin, LoginCon, NewUser, LogoutCon, me, RefreshTokenCon, ForgetPin, ChangePin, TokenPush, approvedCompanyExit, rejectCompanyExit, UpdateUser, UpdateUserLocation } from "../Controller/UserController.js";
import { verifyToken } from "../utils/jwt.js";

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

const router = express.Router();

export const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

router.post("/setpin", SetPin);
router.post("/forgetpin", ForgetPin);
router.post("/changepin", ChangePin);
router.post("/login", LoginCon);
router.post("/refresh", RefreshTokenCon);
router.post("/logout", LogoutCon);
router.post('/newuser', upload.single('profile'), NewUser);
router.put('/updateuser/:userId', upload.single('profile'), UpdateUser);
router.put('/update-location/:userId', upload.single('locationImage'), UpdateUserLocation);
router.post('/token', TokenPush);
router.get("/me", authenticateUser, me);
router.post("/approved-company-exit/:id", approvedCompanyExit);
router.post("/reject-company-exit/:id", rejectCompanyExit);

export default router;