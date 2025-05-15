// routes/users.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/users"); // Assuming this is the correct path to your User model
const router = express.Router();
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  console.log("🔐 Login attempt:", email);

  try {
    const user = await User.findOne({ email: email.trim() });

    if (!user) {
      console.warn("❌ User not found:", email);
      return res.status(400).send({ error: "User does not exist." });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.warn("❌ Invalid password for:", email);
      return res.status(400).send({ error: "Invalid password." });
    }

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "defaultsecret",
      { expiresIn: "1h" }
    );

    console.log("✅ Login successful:", email);
    res.send({
      token,
      user: {
        id: user._id,
        email: user.email,
        isAdmin: user.isAdmin,
        name: user.name,
        pic: user.pic,
      },
    });
  } catch (err) {
    console.error("💥 Error during login:", err);
    res.status(500).send({ error: "Internal server error." });
  }
});

module.exports = router;

// router.post("/login", async (req, res) => {
//   const { username, password } = req.body;
//   console.log(username, password);

//   const user = await User.findOne({ username });

//   if (!user) return res.status(400).send("Invalid username or password.");

//   const validPassword = await bcrypt.compare(password, user.password);

//   if (!validPassword)
//     return res.status(400).send("Invalid username or password.");

//   res.json({ user });
// });

router.post("/register", async (req, res) => {
  const { name, email, password, pic } = req.body;

  // Kiểm tra dữ liệu đầu vào
  if (!name || !email || !password) {
    return res.status(400).send({ error: "All fields are required." });
  }

  try {
    // Kiểm tra xem email hoặc name đã tồn tại chưa
    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser) {
      return res.status(400).send({ error: "Name or email already exists." });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo người dùng mới
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      pic: pic || "assets/avatar_default/default_avatar.jpg", // Sử dụng avatar mặc định nếu không có pic
    });

    // Lưu vào cơ sở dữ liệu
    await newUser.save();

    res.status(201).send({ message: "User registered successfully." });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send({ error: "Internal server error." });
  }
});

// Lấy Thông Tin User Của Tất Cả User Trừ Mật Khẩu
router.get("/getAllUser", async (req, res) => {
  try {
    const users = await User.find({}, "-password"); // exclude password
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/grant-admin/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin: true },
      { new: true } // trả về user sau khi update
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;
