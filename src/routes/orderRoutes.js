import express from "express";
import { addOrderItems } from "../controllers/orderController.js";

const router = express.Router();

router.post("/", addOrderItems);

export default router;