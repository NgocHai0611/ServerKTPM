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
let pRetry;

(async () => {
  const module = await import("p-retry");
  pRetry = module.default;
})();

const cloudinary = require("cloudinary").v2;
const multer = require("multer");
require("dotenv").config();

var app = express();

app.use(cors());
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dioycsndv",
  api_key: process.env.CLOUDINARY_API_KEY || "386921452882728",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || "dRrvRJBEIJux55tAGjOYrJ4n_KY",
});

// Cấu hình Multer
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Lấy tất cả sản phẩm
app.get("/listProduct", async (req, res) => {
  try {
    const listItem = await prisma.products.findMany();
    res.json(listItem);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).send("Error fetching products");
  }
});

// Lấy sản phẩm theo idProduct
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
app.post("/addProduct", upload.single("imgProduct"), async (req, res) => {
  try {
    const { idProduct, productName, unitPrice, desc, size, qtyStock } =
      req.body;

    // Kiểm tra dữ liệu đầu vào
    if (
      !idProduct ||
      !productName ||
      !unitPrice ||
      !desc ||
      !size ||
      !qtyStock
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Kiểm tra idProduct đã tồn tại
    const existingProduct = await prisma.products.findFirst({
      where: { idProduct },
    });
    if (existingProduct) {
      return res.status(400).json({ error: "Product ID already exists" });
    }

    let imgProductUrl =
      "https://res.cloudinary.com/demo/image/upload/default.jpg";
    if (req.file) {
      const base64Image = req.file.buffer.toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "products",
        public_id: `product_${idProduct}`,
        overwrite: true,
      });

      imgProductUrl = uploadResult.secure_url;
    }

    const newProduct = await prisma.products.create({
      data: {
        idProduct,
        productName,
        unitPrice: parseFloat(unitPrice),
        imgProduct: imgProductUrl,
        desc,
        size,
        qtyStock: parseInt(qtyStock),
      },
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
    const product = await prisma.products.findFirst({
      where: { idProduct },
    });
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    await prisma.products.delete({
      where: { id: product.id }, // Sử dụng id (ObjectId) để xóa
    });
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Error deleting product" });
  }
});

// Cập nhật sản phẩm theo idProduct
app.put(
  "/updateProduct/:idProduct",
  upload.single("imgProduct"), // upload dùng memoryStorage
  async (req, res) => {
    try {
      const { idProduct } = req.params;
      const { productName, unitPrice, desc, size, qtyStock } = req.body;

      const product = await prisma.products.findFirst({
        where: { idProduct },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const updateData = {};
      if (productName) updateData.productName = productName;
      if (unitPrice) updateData.unitPrice = parseFloat(unitPrice);
      if (desc) updateData.desc = desc;
      if (size) updateData.size = size;
      if (qtyStock) updateData.qtyStock = parseInt(qtyStock);

      if (req.file) {
        const base64Image = req.file.buffer.toString("base64");
        const dataURI = `data:${req.file.mimetype};base64,${base64Image}`;

        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "products",
          public_id: `product_${idProduct}`,
          overwrite: true,
        });

        updateData.imgProduct = uploadResult.secure_url;
      }

      const updatedProduct = await prisma.products.update({
        where: { id: product.id }, // sử dụng khóa chính
        data: updateData,
      });

      res.json({
        message: "Product updated successfully",
        product: updatedProduct,
      });
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Error updating product" });
    }
  }
);

// Cập nhật tồn kho
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

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
