var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
const cors = require("cors");
const sendOrderPlacedMessage = require("./orderHandler");

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

app.post("/saveOrder", async (req, res) => {
  try {
    const { cartItems, userID, grandTotal } = req.body;
    console.log("Customer ID : ", userID);
    console.log("Product In Cart:  ", cartItems);

    const newOrder = await prisma.orders.create({
      data: {
        orderID: undefined,
        orderDate: new Date(),
        customerID: userID,
        total: grandTotal,
        discount: "0%",
        status: "Pending",
      },
    });

    const orderID = newOrder.orderID; // Lấy orderID vừa tạo

    // 2. Thêm từng sản phẩm vào bảng orderDetails
    const detailPromises = cartItems.map((item) => {
      return prisma.orderDetails.create({
        data: {
          idOrderDetails: undefined,
          orderID: orderID,
          qty: item.qty,
          unitPrice: item.unitPrice,
          productID: item.idProduct,
          nameProduct: item.productName,
        },
      });
    });

    await Promise.all(detailPromises); // Đợi tất cả insert xong
    res.status(201).json({ result: newOrder });
  } catch (error) {
    console.error("Error adding orders :", error);
    res.status(500).json({ error: "Error adding order" });
  }
});

app.get("/revenue/product/yearly", async (req, res) => {
  try {
    const details = await prisma.orderDetails.findMany({
      include: {
        orders: {
          select: {
            orderDate: true,
          },
        },
      },
    });

    const revenueByProductYear = {};

    details.forEach((item) => {
      const year = new Date(item.orders.orderDate).getFullYear();
      const product = item.nameProduct;
      const revenue = item.qty * item.unitPrice;

      if (!revenueByProductYear[year]) {
        revenueByProductYear[year] = {};
      }

      if (!revenueByProductYear[year][product]) {
        revenueByProductYear[year][product] = 0;
      }

      revenueByProductYear[year][product] += revenue;
    });

    res.status(200).json({ revenueByProductYear });
  } catch (error) {
    console.error("Error getting product revenue by year:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/spending/byYear/:customerID", async (req, res) => {
  const { customerID } = req.params;

  try {
    const orders = await prisma.orders.findMany({
      where: { customerID },
      select: {
        total: true,
        orderDate: true,
      },
    });

    const spendingByYear = {};

    orders.forEach((order) => {
      const year = new Date(order.orderDate).getFullYear();
      if (!spendingByYear[year]) {
        spendingByYear[year] = 0;
      }
      spendingByYear[year] += order.total;
    });

    const result = Object.entries(spendingByYear).map(
      ([year, totalSpending]) => ({
        year: parseInt(year),
        totalSpending,
      })
    );

    res.status(200).json(result);
  } catch (error) {
    console.error("Error calculating spending:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// app.post("/order", async (req, res) => {
//   try {
//     await sendOrderPlacedMessage();
//     res.json({ success: true, message: "Order placed message sent." });
//   } catch (err) {
//     console.error("❌ Error sending message:", err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

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
