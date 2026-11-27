import express from "express";
import {
  getStripeOrderConfirmation,
  handleStripeWebhook,
  initiatePayment,
} from "../controllers/paymentController.js";

const router = express.Router();

// POST /api/payment/initiate
router.post("/initiate", initiatePayment);
router.get("/confirmation", getStripeOrderConfirmation);
router.post("/webhook", handleStripeWebhook);

export default router; 