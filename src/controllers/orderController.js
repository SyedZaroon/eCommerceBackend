import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { createOrderSchema } from "../services/zodValidation.js";
import { roundMoney } from "../utils/roundMoney.js";
import { getCurrency } from "../utils/getCurrency.js";
import { getShippingPrice } from "../utils/getShippingPrice.js";


export const addOrderItems = async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid order details.",
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        })),
      });
    }

    const body = parsed.data;

    // Online orders must not be accepted as paid until the selected gateway
    // has been integrated and its server-side payment response is verified.
    if (body.paymentMethod !== "COD") {
      return res.status(503).json({
        success: false,
        message: `${body.paymentMethod} payment verification is not configured. No order was created.`,
      });
    }

    let account;
    if (req.user?.userId) {
      if (!mongoose.isValidObjectId(req.user.userId)) {
        return res.status(401).json({
          success: false,
          message: "The signed-in account is invalid.",
        });
      }
      account = await User.findById(req.user.userId).select("name email status");
      if (!account || account.status !== "Active") {
        return res.status(401).json({
          success: false,
          message: "The signed-in account is unavailable.",
        });
      }
    }

    const phone = body.userInfo?.phone;
    const name = account?.name || body.userInfo?.name;
    const email = account?.email || body.userInfo?.email;
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name, email, and phone are required for guest checkout.",
      });
    }

    const quantities = new Map();
    for (const item of body.orderItems) {
      const productId = item.product.toLowerCase();
      quantities.set(
        productId,
        (quantities.get(productId) || 0) + item.qty,
      );
    }
    if ([...quantities.values()].some((qty) => qty > 1000)) {
      return res.status(400).json({
        success: false,
        message: "Total quantity per product cannot exceed 1000.",
      });
    }

    const products = await Product.find({
      _id: { $in: [...quantities.keys()] },
    });
    if (products.length !== quantities.size) {
      return res.status(404).json({
        success: false,
        message: "One or more products no longer exist.",
      });
    }
    const productsById = new Map(products.map((product) => [product.id, product]));

    const orderItems = [];
    for (const [productId, qty] of quantities) {
      const product = productsById.get(productId);
      if (!Number.isFinite(product.stock) || qty > product.stock) {
        return res.status(409).json({
          success: false,
          message: `${product.title} does not have enough stock.`,
        });
      }

      const price = roundMoney(Number(product.discountPrice));
      if (!Number.isFinite(price) || price < 0) {
        console.error(`Product ${productId} has an invalid discount price.`);
        return res.status(409).json({
          success: false,
          message: "A product is currently unavailable for purchase.",
        });
      }
      orderItems.push({
        product: product._id,
        title: product.title,
        qty,
        price,
        productImg: product.productImg,
      });
    }

    const itemsPrice = roundMoney(
      orderItems.reduce((sum, item) => sum + item.price * item.qty, 0),
    );
    const shippingPrice = getShippingPrice?.(itemsPrice);

    const count = await Order.countDocuments();
    const orderNumber = `ZA-${String(count + 1).padStart(4, '0')}`;

    const order = await Order.create({
      orderNumber: orderNumber,
      user: account?._id,
      userInfo: { fullName: name, email, phoneNumber: phone },
      orderItems,
      shippingAddress: {
        postCode: body.shippingAddress.postalCode,
        address: body.shippingAddress.address,
        additionalInfo: body.shippingAddress.additionalInfo,
        town: body.shippingAddress.town,
        country: body.shippingAddress.country,
      },
      paymentMethod: body.paymentMethod,
      paymentStatus: "Pending",
      currency: getCurrency(),
      itemsPrice,
      shippingPrice,
      totalPrice: roundMoney(itemsPrice + shippingPrice),
    });

    return res.status(201).json({
      success: true,
      message: "Cash-on-delivery order created. Payment is pending.",
      order,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create order.",
    });
  }
};
