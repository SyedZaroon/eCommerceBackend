import productCollection from "../models/productCollectionModel.js";
import Product from "../models/productModel.js";

export const createProductCollection = async (req, res) => {
  try {
    const collectionname = req.body.collectionname?.trim();

    if (!collectionname) {
      return res.status(400).json({
        success: false,
        message: "Collection name is required.",
      });
    }

    const slug = collectionname
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Collection name must contain letters or numbers.",
      });
    }

    const existingCollection = await productCollection.findOne({
      $or: [{ collectionname }, { slug }],
    });

    if (existingCollection) {
      return res.status(400).json({
        success: false,
        message: "Product collection with this name already exists.",
      });
    }

    const newCollection = await productCollection.create({
      collectionname,
      slug,
    });

    return res.status(201).json({
      success: true,
      message: "Product collection created successfully.",
      data: newCollection,
    });
  } catch (error) {
    console.error("Error creating product collection:", error);
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0];
      if (duplicateField === "name") {
        return res.status(500).json({
          success: false,
          message:
            'The database has an obsolete "name_1" index. Drop that index from the productcollections collection.',
        });
      }
      return res.status(409).json({
        success: false,
        message: "Product collection with this name already exists.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

export const deleteProductCollection = async (req, res) => {
  try {
    const deleteCollection = await productCollection.findByIdAndDelete(
      req.params.id,
    );

    if (!deleteCollection) {
      return res
        .status(404)
        .json({ success: false, message: "collection not found" });
    }
    return res.status(200).json({ message: "collection deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const getAllProductCollection = async (req, res) => {
  try {
    const productCollections = await productCollection.find().lean();

    const collectionWithCount = await Promise.all(
      productCollections.map( async (collection)=>{
        const productCount = await Product.countDocuments({
          collections: collection._id,
        })
        return{
          ...collection,
          productCount
        }
      })
    )

    res.status(200).json(collectionWithCount);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};