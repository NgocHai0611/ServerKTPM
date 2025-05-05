var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const PayOS = require("@payos/node");
const cors = require("cors");
require("dotenv").config();
// const { startPaymentConsumer } = require("./paymentHandler");
const amqp = require("amqplib");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");

var app = express();

app.use(
  cors({
    origin: "*", // Cho phép tất cả domain
    methods: "GET, POST, PUT, DELETE, OPTIONS", // Các phương thức được phép
    allowedHeaders: "Content-Type, Authorization", // Các headers được chấp nhận
  })
);

const payOS = new PayOS(
  process.env.ClientID,
  process.env.APIKey,
  process.env.ChecksumKey
);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/users", usersRouter);

app.get("/listPayment", (req, res) => {
  res.json("Payment Service");
});

// app.post("/create-payment-link", async (req, res) => {
//   const YOUR_DOMAIN = "http://localhost:5173/paymentProccess";
//   const body = {
//     orderCode: Number(String(Date.now()).slice(-6)),
//     amount: 2000,
//     description: "Thanh toan don hang",
//     items: [
//       {
//         name: "Mì tôm Hảo Hảo ly",
//         quantity: 1,
//         price: 10000,
//       },
//     ],
//     returnUrl: "http://localhost:5173/paymentSuccess",
//     cancelUrl: "http://localhost:5173/paymentFail",
//   };

//   try {
//     const paymentLinkResponse = await payOS.createPaymentLink(body);

//     res.send(paymentLinkResponse);
//   } catch (error) {
//     console.error(error);
//     res.send("Something went error");
//   }
// });

//
app.post("/create-payment-link", async (req, res) => {
  const YOUR_DOMAIN = "http://localhost:5173/checkout";

  const { grandTotal, cartItems } = req.body;

  console.log(grandTotal, cartItems);

  // ✅ Chuyển đổi cartItems về định dạng đúng với yêu cầu của PayOS
  const formattedItems = cartItems.map((item) => ({
    name: item.productName, // PayOS cần trường 'name'
    quantity: item.qty,
    price: item.unitPrice, // Có thể là số nguyên (đơn vị là VND)
  }));

  const body = {
    orderCode: Number(String(Date.now()).slice(-6)), // Random order code
    amount: grandTotal,
    description: "Thanh toán đơn hàng",
    items: formattedItems, // ✅ Dùng mảng đã format
    returnUrl: "http://localhost:5173/paymentSuccess",
    cancelUrl: "http://localhost:5173/paymentFail",
  };

  try {
    const paymentLinkResponse = await payOS.createPaymentLink(body);

    res.send(paymentLinkResponse);
  } catch (error) {
    console.error(error);
    res.send("Something went error");
  }
});

app.get("/check-payment-status/:orderCode", async (req, res) => {
  const { orderCode } = req.params;

  try {
    const result = await payOS.getPaymentLinkInformation(Number(orderCode));
    res.json(result); // Trả về thông tin đơn hàng gồm status
  } catch (err) {
    console.error(err);
    res.status(500).send("Lỗi khi kiểm tra trạng thái thanh toán");
  }
});

app.get("/payment", async (req, res) => {
  try {
    const connection = await amqp.connect("amqp://rabbitmq");
    const channel = await connection.createChannel();

    await channel.assertExchange("order_events", "direct", { durable: true });

    const q = await channel.assertQueue("payment_queue", { durable: true });

    await channel.bindQueue(q.queue, "order_events", "order.placed");

    channel.consume(q.queue, async (msg) => {
      const order = JSON.parse(msg.content.toString());
      console.log("📥 Received order.placed:", order);

      // Giả lập xử lý thanh toán
      console.log("💳 Processing payment for order:", order.orderId);
    });

    res.json({ success: true, message: "Consumer started for payment_queue" });
  } catch (err) {
    console.error("❌ Error setting up consumer:", err);
    res.status(500).json({ success: false, error: err.message });
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
