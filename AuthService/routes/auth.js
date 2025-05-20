// routes/users.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/users"); // Assuming this is the correct path to your User model
const router = express.Router();
const bcrypt = require("bcryptjs");
require("dotenv").config();
const rateLimit = require("express-rate-limit");
let pRetry;
(async () => {
  const module = await import("p-retry");
  pRetry = module.default;
})();

// 👮‍♂️ Tạo limiter cho route /login
const loginLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 giây
  max: 2, // Chỉ cho phép 2 request trong khoảng thời gian
  standardHeaders: true, // Gửi headers hiện đại
  legacyHeaders: false, // Không cần headers cũ
  message: {
    error:
      "🚫 Too many login attempts. Please wait a few seconds before trying again.",
  },
  skipSuccessfulRequests: false, // ⚠️ Tính cả request đúng lẫn sai!
});

// Get Users (Demo)
const getUserLimit = rateLimit({
  windowMs: 10 * 1000, // 10 giây
  max: 2, // Chỉ cho phép 2 request trong khoảng thời gian
  standardHeaders: true, // Gửi headers hiện đại
  legacyHeaders: false, // Không cần headers cũ
  message: {
    error: "🚫 Too many request to get .",
  },
  skipSuccessfulRequests: false, // ⚠️ Tính cả request đúng lẫn sai!
});

// Login route
router.post("/login", loginLimiter, async (req, res) => {
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
router.get("/getAllUser", getUserLimit, async (req, res) => {
  let hasShownRetryMsg = false;

  try {
    const users = await pRetry(
      async () => {
        try {
          // Thử lấy dữ liệu users
          const users = await User.find({}, "-password");
          return users;
        } catch (err) {
          if (!hasShownRetryMsg) {
            hasShownRetryMsg = true;
            console.log("⚠️ Có 1 chút sự cố vui lòng đợi...");
            // Bạn có thể gửi header custom hoặc log để client nhận biết
            // Ví dụ: res.setHeader('X-Retry-Message', 'Có 1 chút sự cố vui lòng đợi...');
          }
          throw err; // Để pRetry xử lý retry tiếp
        }
      },
      {
        retries: 5,
        minTimeout: 3000, // 3 giây giữa các lần retry
        onFailedAttempt: (error) => {
          console.log(
            `❗ Retry attempt #${error.attemptNumber}: ${error.message}`
          );
        },
      }
    );

    // Nếu thành công, trả data
    res.json(users);
  } catch (error) {
    // Retry vượt quá 5 lần hoặc lỗi khác
    res.status(500).json({ error: "Server đang bị lỗi, quay lại sau" });
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
