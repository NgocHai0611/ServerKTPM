var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
const { client: redisClient, connectRedis } = require("./redisConfig");

var app = express();

app.use(cors());

(async () => {
  try {
    await connectRedis();
    console.log("Redis connected");
  } catch (err) {
    console.error("Redis connection failed", err);
  }
})();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

// Endpoint GET cart

// Thêm sản phẩm vào giỏ hàng (hash)
app.post("/cart/add", async (req, res) => {
  const { userId, item, qty } = req.body;
  console.log("UserID Khi Insert Cart :", userId);
  const key = `cart:${userId}`;
  const field = item.id; // dùng id sản phẩm làm field trong hash

  try {
    // Kiểm tra xem sản phẩm đã có trong giỏ chưa
    const existingItem = await redisClient.hGet(key, field);
    let updatedItem;

    if (existingItem) {
      const parsed = JSON.parse(existingItem);
      parsed.qty += qty;
      updatedItem = parsed;
    } else {
      updatedItem = { ...item, qty };
    }

    await redisClient.hSet(key, field, JSON.stringify(updatedItem));
    const data = await redisClient.hGetAll(key);
    const cart = Object.values(data).map((val) => JSON.parse(val));
    res.json({ success: true, cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Thêm sản phẩm thất bại!" });
  }
});

// Xóa một sản phẩm khỏi giỏ hàng
// Xóa một sản phẩm khỏi giỏ hàng (hash)
app.delete("/cart/remove/:userId/:itemId", async (req, res) => {
  const { userId, itemId } = req.params;
  const key = `cart:${userId}`;

  try {
    await redisClient.hDel(key, itemId);
    const allItems = await redisClient.hGetAll(key);
    const cart = Object.values(allItems).map((val) => JSON.parse(val));

    res.json({ success: true, cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Xóa sản phẩm thất bại!" });
  }
});

// Cập nhật số lượng sản phẩm
// Cập nhật số lượng sản phẩm (hash)
app.put("/cart/updateQty", async (req, res) => {
  const { userId, itemId, qty } = req.body;
  const key = `cart:${userId}`;

  try {
    const existing = await redisClient.hGet(key, itemId);
    if (!existing) {
      return res.status(404).json({ error: "Sản phẩm không tồn tại!" });
    }

    const parsed = JSON.parse(existing);
    parsed.qty = qty;

    await redisClient.hSet(key, itemId, JSON.stringify(parsed));
    const allItems = await redisClient.hGetAll(key);
    const cart = Object.values(allItems).map((val) => JSON.parse(val));

    res.json({ success: true, cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Cập nhật số lượng thất bại!" });
  }
});

// Xóa toàn bộ giỏ hàng (hash)
app.delete("/cart/clear/:userId", async (req, res) => {
  const { userId } = req.params;
  const key = `cart:${userId}`;

  try {
    await redisClient.del(key);
    res.json({ success: true, message: "Đã xóa toàn bộ giỏ hàng" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể xóa giỏ hàng!" });
  }
});

// Lấy giỏ hàng (hash)
app.get("/cart/:userId", async (req, res) => {
  const { userId } = req.params;
  const key = `cart:${userId}`;

  try {
    const data = await redisClient.hGetAll(key);
    const cart = Object.values(data).map((val) => JSON.parse(val));
    res.json({ success: true, cart });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể lấy giỏ hàng!" });
  }
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
