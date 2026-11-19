import mongoose from "mongoose";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import {
  createOrderSchema,
  updateOrderSchema,
} from "../services/zodValidation.js";
import { roundMoney } from "../utils/roundMoney.js";
import { getCurrency } from "../utils/getCurrency.js";
import { getShippingPrice } from "../utils/getShippingPrice.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getOrderIdentifierQuery = (identifier) => {
  if (mongoose.isValidObjectId(identifier)) {
    return { _id: identifier };
  }
  if (/^[A-Za-z0-9-]{1,64}$/.test(identifier)) {
    return { orderNumber: identifier };
  }
  return null;
};

const normalizeRefundedOrder = (order) => {
  if (order.orderStatus !== "Cancelled" || order.paymentStatus !== "Refunded") {
    return order;
  }

  const originalTotalPrice =
    order.originalTotalPrice ??
    (order.totalPrice || roundMoney((order.itemsPrice || 0) + (order.shippingPrice || 0)));
  return {
    ...order,
    originalTotalPrice,
    refundedAmount: order.refundedAmount || originalTotalPrice,
    refundReason: order.refundReason || "Order canceled",
    totalPrice: 0,
  };
};

export const getAllOrders = async (req, res) => {
  try {
    const pageValue = req.query.page === undefined ? "1" : req.query.page;
    const limitValue = req.query.limit === undefined ? "10" : req.query.limit;
    const page = Number(pageValue);
    const limit = Number(limitValue);
    if (
      typeof pageValue !== "string" ||
      typeof limitValue !== "string" ||
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer and limit must be between 1 and 100.",
      });
    }

    const searchTerm = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (req.query.q !== undefined && typeof req.query.q !== "string") {
      return res.status(400).json({
        success: false,
        message: "Search query must be a string.",
      });
    }
    if (searchTerm.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot exceed 100 characters.",
      });
    }

    const filter = {};
    if (searchTerm) {
      const searchRegex = new RegExp(escapeRegex(searchTerm), "i");
      const searchConditions = [
        { orderNumber: searchRegex },
        { "userInfo.fullName": searchRegex },
        { "userInfo.email": searchRegex },
        { "shippingAddress.postCode": searchRegex },
        { "shippingAddress.address": searchRegex },
        { "shippingAddress.town": searchRegex },
        { "shippingAddress.country": searchRegex },
        { paymentMethod: searchRegex },
      ];
      const compactPostCode = searchTerm.replace(/\s+/g, "");
      if (compactPostCode) {
        searchConditions.push({
          "shippingAddress.postCode": new RegExp(
            [...compactPostCode].map(escapeRegex).join("\\s*"),
            "i",
          ),
        });
      }
      if (mongoose.isValidObjectId(searchTerm)) {
        searchConditions.push({ _id: searchTerm });
      } else if (/^[a-f\d]{1,24}$/i.test(searchTerm)) {
        searchConditions.push({
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: escapeRegex(searchTerm),
              options: "i",
            },
          },
        });
      }

      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      })
        .select("_id")
        .lean();
      if (matchingUsers.length) {
        searchConditions.push({ user: { $in: matchingUsers.map(({ _id }) => _id) } });
      }
      filter.$or = searchConditions;
    }

    const [totalOrders, orders] = await Promise.all([
      Order.countDocuments(filter),
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name email")
        .lean(),
    ]);
    const normalizedOrders = orders.map(normalizeRefundedOrder);
    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully.",
      data: {
        orders: normalizedOrders,
        pagination: {
          totalOrders,
          currentPage: page,
          totalPages,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch orders.",
    });
  }
};

const getOrdersForUser = async (req, res, user) => {
  const pageValue = req.query.page === undefined ? "1" : req.query.page;
  const limitValue = req.query.limit === undefined ? "10" : req.query.limit;
  const page = Number(pageValue);
  const limit = Number(limitValue);
  if (
    typeof pageValue !== "string" ||
    typeof limitValue !== "string" ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Page must be a positive integer and limit must be between 1 and 100.",
    });
  }

  const filter = {
    $or: [
      { user: user._id },
      { "userInfo.email": user.email.trim().toLowerCase() },
    ],
  };
  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);
  const totalPages = Math.ceil(totalOrders / limit);

  return res.status(200).json({
    success: true,
    message: "User orders fetched successfully.",
    data: {
      orders: orders.map(normalizeRefundedOrder),
      pagination: {
        totalOrders,
        currentPage: page,
        totalPages,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
};

export const getMyOrders = async (req, res) => {
  try {
    return await getOrdersForUser(req, res, req.currentUser);
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch your orders.",
    });
  }
};

export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        success: false,
        message: "User ID is invalid.",
      });
    }

    const user = await User.findById(userId).select("_id email").lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return await getOrdersForUser(req, res, user);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch this user's orders.",
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const identifierQuery = getOrderIdentifierQuery(req.params.id);
    if (!identifierQuery) {
      return res.status(400).json({
        success: false,
        message: "Order ID or order number is invalid.",
      });
    }

    const order = await Order.findOne(identifierQuery)
      .populate("user", "name email")
      .populate("orderItems.product", "title description sku productImg basePrice discountPrice")
      .lean();
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully.",
      data: normalizeRefundedOrder(order),
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch order.",
    });
  }
};

export const updateOrder = async (req, res) => {
  try {
    const identifierQuery = getOrderIdentifierQuery(req.params.id);
    if (!identifierQuery) {
      return res.status(400).json({
        success: false,
        message: "Order ID or order number is invalid.",
      });
    }

    const parsed = updateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid order update.",
        errors: parsed.error.issues.map(({ path, message }) => ({
          field: path.join("."),
          message,
        })),
      });
    }
    const body = parsed.data;
    const order = await Order.findOne(identifierQuery);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const userInfoUpdates = { ...body.userInfo };
    if (body.customerName !== undefined) userInfoUpdates.fullName = body.customerName;
    if (body.customerEmail !== undefined) userInfoUpdates.email = body.customerEmail;
    if (body.customerPhone !== undefined) userInfoUpdates.phoneNumber = body.customerPhone;
    if (Object.keys(userInfoUpdates).length) {
      order.userInfo = { ...order.userInfo.toObject(), ...userInfoUpdates };
    }
    if (body.shippingAddress) {
      order.shippingAddress = {
        ...order.shippingAddress.toObject(),
        ...body.shippingAddress,
      };
    }
    if (body.paymentMethod !== undefined) order.paymentMethod = body.paymentMethod;
    if (body.paymentStatus !== undefined) order.paymentStatus = body.paymentStatus;
    if (body.orderStatus !== undefined) order.orderStatus = body.orderStatus;
    if (body.orderStatus === "Cancelled" || body.paymentStatus === "Refunded") {
      order.orderStatus = "Cancelled";
      order.paymentStatus = "Refunded";
    }
    if (body.shippingPrice !== undefined) order.shippingPrice = roundMoney(body.shippingPrice);

    if (body.orderItems !== undefined) {
      const quantities = new Map();
      for (const item of body.orderItems) {
        const productId = item.product.toLowerCase();
        quantities.set(productId, (quantities.get(productId) || 0) + item.qty);
      }
      if ([...quantities.values()].some((qty) => qty > 1000)) {
        return res.status(400).json({
          success: false,
          message: "Total quantity per product cannot exceed 1000.",
        });
      }

      const products = await Product.find({ _id: { $in: [...quantities.keys()] } });
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
      order.orderItems = orderItems;
    }

    if (body.orderItems !== undefined || body.shippingPrice !== undefined) {
      order.itemsPrice = roundMoney(
        order.orderItems.reduce((sum, item) => sum + item.price * item.qty, 0),
      );
      order.totalPrice = roundMoney(order.itemsPrice + order.shippingPrice);
    }

    if (order.orderStatus === "Cancelled" && order.paymentStatus === "Refunded") {
      order.originalTotalPrice ??= order.totalPrice;
      order.refundedAmount = order.originalTotalPrice;
      order.refundReason ||= "Order canceled";
      order.totalPrice = 0;
    } else {
      order.originalTotalPrice = order.totalPrice;
      order.refundedAmount = 0;
      order.refundReason = undefined;
    }

    await order.save();
    await order.populate([
      { path: "user", select: "name email" },
      { path: "orderItems.product", select: "title description sku productImg basePrice discountPrice" },
    ]);
    return res.status(200).json({
      success: true,
      message: "Order updated successfully.",
      data: order,
    });
  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update order.",
    });
  }
};

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

    if (!account) {
      account = await User.findOne({ email: email.trim().toLowerCase() })
        .select("_id")
        .lean();
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
      originalTotalPrice: roundMoney(itemsPrice + shippingPrice),
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
