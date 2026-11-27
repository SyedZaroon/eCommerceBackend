import mongoose from "mongoose";
import Stripe from "stripe";
import Order from "../models/orderModel.js";
import { APPLICATIONS } from "../config/applications.js";

let stripeClient;

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

const getOrderIdFromSession = (session) => {
  const orderId = session.metadata?.orderId;
  return mongoose.isValidObjectId(orderId) ? orderId : null;
};

const recordPaidSession = async (session, event) => {
  const orderId = getOrderIdFromSession(session);
  if (!orderId || session.payment_status !== "paid") {
    return null;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      paymentMethod: "Stripe",
      "paymentDetails.gatewayReference": session.id,
      paymentStatus: { $ne: "Paid" },
    },
    {
      $set: {
        paymentStatus: "Paid",
        "paymentDetails.transactionId": paymentIntentId,
        "paymentDetails.gatewayResponse": {
          eventId: event?.id,
          eventType: event?.type || "checkout.session.completed",
          responseCode: "200",
          paymentStatus: session.payment_status,
          currency: session.currency?.toUpperCase(),
          amount: Number.isFinite(session.amount_total)
            ? session.amount_total / 100
            : undefined,
        },
        "paymentDetails.paidAt": session.created
          ? new Date(session.created * 1000)
          : new Date(),
      },
    },
    { new: true },
  );

  if (order) {
    return order;
  }

  return Order.findOne({
    _id: orderId,
    paymentMethod: "Stripe",
    "paymentDetails.gatewayReference": session.id,
    paymentStatus: "Paid",
  });
};

export const initiatePayment = async (req, res) => {
  try {
    const { paymentMethod, orderId } = req.body;

    if (paymentMethod !== "Stripe") {
      return res.status(400).json({
        success: false,
        message: "Unsupported payment method.",
      });
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({
        success: false,
        message: "A valid order ID is required.",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      paymentMethod: "Stripe",
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Stripe order not found.",
      });
    }
    if (order.paymentStatus === "Paid") {
      return res.status(409).json({
        success: false,
        message: "This order has already been paid.",
      });
    }

    const stripe = getStripeClient();
    if (order.paymentDetails.gatewayReference) {
      const previousSession = await stripe.checkout.sessions.retrieve(
        order.paymentDetails.gatewayReference,
      );
      if (previousSession.status === "open" && previousSession.url) {
        return res.status(200).json({
          success: true,
          paymentUrl: previousSession.url,
        });
      }
    }

    const totalAmount = Math.round(Number(order.totalPrice) * 100);
    if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "The order amount is invalid for Stripe checkout.",
      });
    }

    const frontendUrl = (
      process.env.CLIENT_URL || APPLICATIONS.client.origin
    ).replace(/\/+$/, "");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.userInfo.email,
      client_reference_id: String(order._id),
      allowed_payment_method_types: ["card"],
      metadata: {
        orderId: String(order._id),
        orderNumber: order.orderNumber,
      },
      line_items: [
        {
          price_data: {
            currency: order.currency.toLowerCase(),
            product_data: {
              name: `Order ${order.orderNumber}`,
            },
            unit_amount: totalAmount,
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendUrl}/thankyou?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/checkout?payment=cancelled`,
    });

    order.paymentDetails.gatewayReference = session.id;
    await order.save();

    return res.status(200).json({
      success: true,
      paymentUrl: session.url,
    });
  } catch (error) {
    console.error("Initiate payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initiate payment",
    });
  }
};

export const getStripeOrderConfirmation = async (req, res) => {
  try {
    const { session_id: sessionId } = req.query;
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return res.status(400).json({
        success: false,
        message: "A valid Stripe checkout session ID is required.",
      });
    }

    const session = await getStripeClient().checkout.sessions.retrieve(sessionId);
    const orderId = getOrderIdFromSession(session);
    if (!orderId) {
      return res.status(404).json({
        success: false,
        message: "No order is associated with this checkout session.",
      });
    }

    if (session.payment_status === "paid") {
      await recordPaidSession(session);
    }

    const order = await Order.findOne({
      _id: orderId,
      paymentMethod: "Stripe",
      "paymentDetails.gatewayReference": session.id,
    })
      .populate(
        "orderItems.product",
        "title description sku productImg basePrice discountPrice",
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found for this checkout session.",
      });
    }

    if (order.paymentDetails) {
      delete order.paymentDetails.gatewayReference;
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Stripe order confirmation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to verify this Stripe payment.",
    });
  }
};

export const handleStripeWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not configured.");
    return res.status(500).json({
      success: false,
      message: "Stripe webhook is not configured.",
    });
  }

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    return res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature.",
    });
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object;
      const order = await recordPaidSession(session, event);
      if (session.payment_status === "paid" && !order) {
        throw new Error(`No matching order found for Stripe session ${session.id}.`);
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const orderId = getOrderIdFromSession(session);
      if (orderId) {
        await Order.findOneAndUpdate(
          {
            _id: orderId,
            paymentMethod: "Stripe",
            "paymentDetails.gatewayReference": session.id,
            paymentStatus: { $ne: "Paid" },
          },
          {
            $set: {
              paymentStatus: "Failed",
              "paymentDetails.gatewayResponse": {
                eventId: event.id,
                eventType: event.type,
                paymentStatus: "unpaid",
                currency: session.currency?.toUpperCase(),
              },
            },
          },
        );
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to process Stripe webhook.",
    });
  }
};
