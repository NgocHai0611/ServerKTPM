const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/users");
const router = express.Router();
const bcrypt = require("bcryptjs");
const cloudinary = require('cloudinary').v2;
const multer = require("multer");
const path = require("path");
require("dotenv").config();

// Cấu hình Cloudinary từ biến môi trường
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dioycsndv",
  api_key: process.env.CLOUDINARY_API_KEY || "386921452882728",
  api_secret: process.env.CLOUDINARY_API_SECRET || "dRrvRJBEIJux55tAGjOYrJ4n_KY",
});

// Cấu hình Multer để xử lý file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Thư mục tạm để lưu file
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png) are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
});

// Middleware xác thực token
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).send({ error: "Please authenticate." });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "defaultsecret");
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).send({ error: "Invalid token." });
  }
};

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

// Register route
router.post("/register", async (req, res) => {
  const { name, email, password, pic } = req.body;

  if (!name || !email || !password) {
    return res.status(400).send({ error: "All fields are required." });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { name }] });
    if (existingUser) {
      return res.status(400).send({ error: "Name or email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      pic: pic || "assets/avatar_default/default_avatar.jpg",
    });

    await newUser.save();
    res.status(201).send({ message: "User registered successfully." });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).send({ error: "Internal server error." });
  }
});

// Get all users (excluding password)
router.get("/getAllUser", async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Grant admin role
router.put("/grant-admin/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { isAdmin: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Update user profile
router.put("/update/:id", authMiddleware, upload.single("pic"), async (req, res) => {
  const userId = req.params.id;
  const { name, email, password } = req.body;

  if (req.userId !== userId) {
    return res.status(403).send({ error: "You can only update your own profile." });
  }

  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      // Kiểm tra email có trùng với user khác không
      const existingEmail = await User.findOne({ email, _id: { $ne: userId } });
      if (existingEmail) {
        return res.status(400).send({ error: "Email already exists." });
      }
      updateData.email = email;
    }
    if (password) updateData.password = await bcrypt.hash(password, 10);

    // Nếu có file ảnh được gửi lên
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "user_avatars",
          public_id: `avatar_${userId}`,
          overwrite: true,
        });
        updateData.pic = uploadResult.secure_url;
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).send({ error: "Failed to upload image." });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).send({ error: "User not found." });
    }

    res.send({
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        pic: updatedUser.pic,
        isAdmin: updatedUser.isAdmin,
      },
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).send({ error: "Internal server error." });
  }
});

module.exports = router;