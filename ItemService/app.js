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

// app.use("/", indexRouter);

// Lấy tất cả sản phẩm
app.get("/listProduct", async (req, res) => {
  try {
    const listItem = await prisma.products.findMany();
    res.json(listItem);
  } catch (error) {
    console.error("Error fetching movies:", error);
    res.status(500).send("Error fetching movies");
  }
});

app.get("/product/:idProduct", async (req, res) => {
  try {
    const { idProduct } = req.params;

    const product = await prisma.products.findFirst({
      where: { idProduct },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Error fetching product" });
  }
});

// Thêm sản phẩm
app.post("/addProduct", async (req, res) => {
  try {
    const { idProduct, productName, unitPrice, imgProduct, desc, size } =
      req.body;
    const newProduct = await prisma.products.create({
      data: { idProduct, productName, unitPrice, imgProduct, desc, size },
    });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Error adding product" });
  }
});

// Xóa sản phẩm theo ID
app.delete("/deleteProduct/:idProduct", async (req, res) => {
  try {
    const { idProduct } = req.params;
    await prisma.products.deleteMany({ where: { idProduct } });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Error deleting product" });
  }
});

// Cập nhật sản phẩm theo idProduct
app.put("/updateProduct/:idProduct", async (req, res) => {
  try {
    const { idProduct } = req.params;
    const { productName, unitPrice, imgProduct, desc, size } = req.body;
    const updatedProduct = await prisma.products.updateMany({
      where: { idProduct },
      data: { productName, unitPrice, imgProduct, desc, size },
    });

    if (updatedProduct.count === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Error updating product" });
  }
});

app.post("/update-stock", async (req, res) => {
  const { cartItems } = req.body;

  try {
    for (const item of cartItems) {
      const { idProduct, qty } = item;

      const product = await prisma.products.findFirst({
        where: { idProduct },
      });

      if (!product) {
        console.warn(`Không tìm thấy sản phẩm với idProduct: ${idProduct}`);
        continue;
      }

      console.log("Sản phẩm mua hàng:", product);

      await prisma.products.update({
        where: { id: product.id },
        data: {
          qtyStock: product.qtyStock - qty,
        },
      });
    }

    return res.status(200).json({ message: "Đã cập nhật tồn kho" });
  } catch (error) {
    console.error("Lỗi cập nhật tồn kho:", error);
    return res.status(500).json({ message: "Lỗi cập nhật kho", error });
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
