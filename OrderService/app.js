var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");

const { PrismaClient } = require("@prisma/client");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
const prisma = new PrismaClient();

var app = express();
app.use(cors());

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Lấy tất cả đơn hàng
app.get("/listOrder", async (req, res) => {
  try {
    const listItem = await prisma.orders.findMany();
    res.json(listItem);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).send("Error fetching movies");
  }
});

app.get("/listOrderDetail", async (req, res) => {
  try {
    const listItem = await prisma.orderDetails.findMany();
    res.json(listItem);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).send("Error fetching movies");
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
