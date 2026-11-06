import ProductCollection from "../models/productCollectionModel.js";
import Product from "../models/productModel.js";
import { convertToSlug } from "../utils/convertToSlug.js";
import imagekit from "../utils/imagekit.js";
import mongoose from "mongoose";

const getCollectionIds = (body) => {
  const value = body["collections[]"] ?? body.collections;
  if (value === undefined || value === "") {
    return [];
  }

  return (Array.isArray(value) ? value : [value])
    .flatMap((collection) => String(collection).split(","))
    .filter(Boolean);
};

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const { title, description, basePrice, discountPrice, stock, sku } =
      req.body;
    const collections = getCollectionIds(req.body);

    // Check if the SKU already exists
    const existingProduct = await Product.findOne({ sku });
    if (existingProduct) {
      return res.status(400).json({ message: "SKU already exists" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    if (Number(discountPrice) >= Number(basePrice)) {
      return res
        .status(400)
        .json({ message: "Base price must be greater than discount price" });
    }

    const uploadResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName: `product_${Date.now()}_${req.file.originalname}`,
      folder: "/eCommerce/products",
    });

    const slug = await convertToSlug(title);

    const newProduct = new Product({
      title,
      description,
      basePrice,
      discountPrice,
      stock,
      sku,
      productImg: uploadResponse.url,
      slug,
      collections,
    });

    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    // 1. Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // 2. Query parameters
    const search = req.query.search?.trim();
    const collectionSlug = req.query.collection?.trim();
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const inStockOnly = req.query.inStockOnly === "true";
    const sort = req.query.sort || "newest";

    // 3. Build filter
    const filter = {};

    // Search by title or SKU
    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { sku: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    // Filter by collection slug
    if (collectionSlug) {
      const collection = await ProductCollection.findOne({
        slug: collectionSlug,
      }).select("_id");

      if (!collection) {
        return res.status(200).json({
          success: true,
          products: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalProducts: 0,
            limit,
          },
        });
      }

      filter.collections = collection._id;
    }

    if (inStockOnly) {
      filter.stock = { $gt: 0 };
    }

    // Filter by price
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.basePrice = {};

      if (minPrice !== undefined && minPrice !== "") {
        const min = Number(minPrice);

        if (!Number.isFinite(min) || min < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid minimum price",
          });
        }

        filter.basePrice.$gte = min;
      }

      if (maxPrice !== undefined && maxPrice !== "") {
        const max = Number(maxPrice);

        if (!Number.isFinite(max) || max < 0) {
          return res.status(400).json({
            success: false,
            message: "Invalid maximum price",
          });
        }

        filter.basePrice.$lte = max;
      }

      if (
        filter.basePrice.$gte !== undefined &&
        filter.basePrice.$lte !== undefined &&
        filter.basePrice.$gte > filter.basePrice.$lte
      ) {
        return res.status(400).json({
          success: false,
          message: "Minimum price cannot exceed maximum price",
        });
      }
    }

    // 4. Sorting
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      price_asc: { discountPrice: 1 },
      price_desc: { discountPrice: -1 },
      name_asc: { title: 1 },
      name_desc: { title: -1 },
    };

    if (!sortOptions[sort]) {
      return res.status(400).json({
        success: false,
        message: "Invalid sort option",
      });
    }

    // 5. Fetch products and count matching results
    const [products, totalProducts] = await Promise.all([
      Product.find(filter)
        .sort(sortOptions[sort])
        .skip(skip)
        .limit(limit),

      Product.countDocuments(filter),
    ]);

    // 6. Response
    res.status(200).json({
      success: true,
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Get a product by ID

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const product = isObjectId
      ? await Product.findById(id)
      : await Product.findOne({ slug: id });

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    return res.status(200).json(product);
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};

  export const getProductById = async (req, res) => {
    try {
      const { id } = req.params;

      const isObjectId = mongoose.Types.ObjectId.isValid(id);

      const product = isObjectId
        ? await Product.findById(id)
        : await Product.findOne({ slug: id });

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      return res.status(200).json(product);
    } catch (error) {
      return res.status(500).json({
        message: error.message,
      });
    }
  };

  // Update a product
  export const updateProduct = async (req, res) => {
    try {
      const updates = {};
      for (const field of [
        "title",
        "description",
        "basePrice",
        "discountPrice",
        "stock",
        "sku",
      ]) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // Price validation
      if (
        req.body.basePrice !== undefined ||
        req.body.discountPrice !== undefined
      ) {
        const existingProduct = await Product.findById(req.params.id);

        if (!existingProduct) {
          return res.status(404).json({ message: "Product not found" });
        }

        const basePrice = Number(req.body.basePrice ?? existingProduct.basePrice);

        const discountPrice = Number(
          req.body.discountPrice ?? existingProduct.discountPrice,
        );

        if (discountPrice >= basePrice) {
          return res.status(400).json({
            message: "Base price must be greater than discount price",
          });
        }
      }

      if (
        req.body["collections[]"] !== undefined ||
        req.body.collections !== undefined
      ) {
        updates.collections = getCollectionIds(req.body);
      }

      if (req.file) {
        const uploadResponse = await imagekit.upload({
          file: req.file.buffer,
          fileName: `product_${Date.now()}_${req.file.originalname}`,
          folder: "/eCommerce/products",
        });
        updates.productImg = uploadResponse.url;
      }

      const updatedProduct = await Product.findByIdAndUpdate(
        req.params.id,
        { $set: updates },
        { new: true, runValidators: true },
      );
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(200).json(updatedProduct);
    } catch (error) {
      const statusCode = error.code === 11000 ? 400 : 500;
      res.status(statusCode).json({ message: error.message });
    }
  };

  // Delete a product
  export const deleteProduct = async (req, res) => {
    try {
      const deletedProduct = await Product.findByIdAndDelete(req.params.id);
      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.status(200).json({ message: "Product deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};
