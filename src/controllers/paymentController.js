import crypto from "crypto";
import Order from "../models/orderModel.js";


const generateJazzCashHash = (dataPayload, salt) => {
  const sortedKeys = Object.keys(dataPayload).sort();
  let hashString = salt;

  sortedKeys.forEach((key) => {
    if (dataPayload[key] !== "" && dataPayload[key] !== undefined) {
      hashString += `&${dataPayload[key]}`;
    }
  });

  return crypto
    .createHmac("sha256", salt)
    .update(hashString)
    .digest("hex");
};


const handleJazzCashPayment = async (orderData, res) => {
  try {
    const { orderItems, shippingAddress, userInfo, totalPrice } = orderData;

    if (!totalPrice || !userInfo?.phone || !userInfo?.email) {
      return res.status(400).json({
        success: false,
        message: "Missing required order details for JazzCash.",
      });
    }

    const txnRefNo = `T${Date.now()}`;

    // JazzCash Payload
    const jazzCashPayload = {
      pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
      pp_Password: process.env.JAZZCASH_PASSWORD,
      pp_TxnRefNo: txnRefNo,
      pp_Amount: Math.round(totalPrice * 100), // Amount paison mein
      pp_NoOfItems: orderItems.length.toString(),
      pp_Description: "E-Commerce Order Payment",
      pp_TxnCurrency: "PKR",
      pp_BillReference: "billRef",
      pp_Language: "EN",
      pp_CustomerEmail: userInfo.email,
      pp_CustomerMobileNo: userInfo.phone,
      pp_ResponseURL: `${process.env.FRONTEND_URL}/payment-success`,
    };

    // Hash generate karna
    const secureHash = generateJazzCashHash(
      jazzCashPayload,
      process.env.JAZZCASH_SALT
    );
    jazzCashPayload.pp_SecureHash = secureHash;

    return res.status(200).json({
      success: true,
      message: "JazzCash payment initialized successfully",
      gatewayData: jazzCashPayload,
      paymentUrl: process.env.JAZZCASH_API_URL,
    });
  } catch (error) {
    console.error("JazzCash Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Main Unified Payment Controller (Switch-Case)
export const initiatePayment = async (req, res) => {
  try {
    const { paymentMethod, ...orderData } = req.body;

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required.",
      });
    }

    switch (paymentMethod) {
      case "COD":
        return res.status(400).json({
          success: false,
          message: "Please use /api/orders endpoint for COD.",
        });

      case "JazzCash":
        return handleJazzCashPayment(orderData, res);

      // Future mein yahan EasyPaisa ya Stripe ka case add ho jayega
      // case "EasyPaisa":
      //   return handleEasyPaisaPayment(orderData, res);

      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported payment method: ${paymentMethod}`,
        });
    }
  } catch (error) {
    console.error("Payment initiation error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};