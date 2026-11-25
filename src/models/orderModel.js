import mongoose from "mongoose";

const paymentDetailsSchema = new mongoose.Schema(
  {
    transactionId: String,
    gatewayReference: String,
    gatewayResponse: {
      eventId: String,
      eventType: String,
      responseCode: String,
      paymentStatus: String,
      currency: String,
      amount: Number,
    },
    paidAt: Date,
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    userInfo: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, lowercase: true, trim: true },
      phoneNumber: { type: String, required: true },
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
          ref: "Product",
        },
        title: {
          type: String,
          required: true,
        },
        qty: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        productImg: {
          type: String,
          required: true,
        },
      },
    ],
    shippingAddress: {
      postCode: { type: String, required: true },
      address: { type: String, required: true },
      additionalInfo: { type: String },
      town: { type: String },
      country: { type: String, required: true, default: "Pakistan" },
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ["COD", "JazzCash", "EasyPaisa"],
      default: "COD",
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    paymentDetails: { type: paymentDetailsSchema, default: () => ({}) },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      default: "PKR",
    },
    itemsPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    shippingPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    shippingMethod: {
      type: String,
      enum: ["standard", "next_day"],
      default: "standard",
      required: true,
    },
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
      min: 0,
    },
    originalTotalPrice: {
      type: Number,
      min: 0,
    },
    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundReason: {
      type: String,
      trim: true,
    },
    orderStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending",
    },
    deliveredAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

orderSchema
  .path("orderItems")
  .validate(
    (items) => Array.isArray(items) && items.length > 0,
    "An order must contain at least one item.",
  );

orderSchema.index({ createdAt: -1 });

const Order = mongoose.model("Order", orderSchema);

export default Order;
