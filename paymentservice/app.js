var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const PayOS = require("@payos/node");
const cors = require("cors");
require("dotenv").config();

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
