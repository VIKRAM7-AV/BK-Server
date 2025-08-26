import jwt from 'jsonwebtoken';

const getToken = (user,res) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.cookie("token", token, {
      maxAge: 48 * 7 * 24 * 60 * 60 * 1000, 
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "none"
  });
};

export default getToken;
