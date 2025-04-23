// routes/users.js
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/users"); // Assuming this is the correct path to your User model
const router = express.Router();
const bcrypt = require("bcryptjs");

// Login route
// router.post("/login", async (req, res) => {
//   const { username, password } = req.body;
//   console.log(username, password);

//   const user = await User.findOne({ username });

//   if (!user) return res.status(400).send("Invalid username or password.");

//   const validPassword = await bcrypt.compare(password, user.password);

//   if (!validPassword)
//     return res.status(400).send("Invalid username or password.");

//   const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);

//   res.send({ token });
// });

router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(username, password);

  const user = await User.findOne({ username });

  if (!user) return res.status(400).send("Invalid username or password.");

  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword)
    return res.status(400).send("Invalid username or password.");

  res.json({ user });
});

// Register route
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      password: hashedPassword,
    });

    const savedUser = await user.save();
    res.json({
      message: "User registered successfully",
      userId: savedUser._id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Export the router
module.exports = router;
