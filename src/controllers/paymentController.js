import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const paymentHandlers = {
  Stripe: handleStripePayment,
};

export const initiatePayment = async (req, res) => {
  try {
    const { paymentMethod, itemsPrice, shippingPrice = 0 } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }
    const totalAmount = Number(itemsPrice || 0) + Number(shippingPrice || 0);
    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount",
      });
    }

    const handler = paymentHandlers[paymentMethod];
    if (!handler) {
      return res.status(400).json({
        success: false,
        message: `Unsupported payment method: ${paymentMethod}`,
      });
    }

    return await handler(req, res, totalAmount);
  } catch (error) {
    console.error("Initiate payment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initiate payment",
    });
  }
};


async function handleStripePayment(req, res, totalAmount) {
  const { userInfo } = req.body;

  const session = await stripe.checkout.sessions.create({
    allowed_payment_method_types: ["card"],
    mode: "payment",
    customer_email: userInfo?.email || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Store Order",
          },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      },
    ],
    success_url: "http://localhost:3000/thankyou",
    cancel_url: "http://localhost:3000/checkout",
  });

  return res.status(200).json({
    success: true,
    paymentUrl: session.url,
  });
}