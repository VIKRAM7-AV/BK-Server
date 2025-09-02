
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

export const signAccessToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "15m" });
};

export const signRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: "7d" });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
