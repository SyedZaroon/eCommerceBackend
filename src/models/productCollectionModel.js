import mongoose from "mongoose";

const productCollectionSchema = new mongoose.Schema(
  {
    collectionname: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
  },
  { timestamps: true }
);
const ProductCollection = mongoose.model("ProductCollection", productCollectionSchema);

export default ProductCollection;