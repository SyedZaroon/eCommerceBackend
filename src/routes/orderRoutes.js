import express from "express";
import {
	addOrderItems,
	getAllOrders,
	getOrderById,
	updateOrder,
} from "../controllers/orderController.js";
import {
	authorizePermission,
	checkUserActive,
	verifyToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
	"/",
	verifyToken,
	checkUserActive,
	authorizePermission("ORDER", "READ"),
	getAllOrders,
);
router.get(
	"/:id",
	verifyToken,
	checkUserActive,
	authorizePermission("ORDER", "READ"),
	getOrderById,
);
router.put(
	"/:id",
	verifyToken,
	checkUserActive,
	authorizePermission("ORDER", "UPDATE"),
	updateOrder,
);
router.post("/", addOrderItems);

export default router;