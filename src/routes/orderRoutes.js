import express from "express";
import {
	addOrderItems,
	getAllOrders,
	getOrderById,
	getMyOrders,
	getOrdersByUser,
	updateOrder,
} from "../controllers/orderController.js";
import {
	authorizePermission,
	checkUserActive,
	optionalVerifyToken,
	verifyToken,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
	"/mine",
	verifyToken,
	checkUserActive,
	authorizePermission("ORDER", "VIEW"),
	getMyOrders,
);
router.get(
	"/user/:userId",
	verifyToken,
	checkUserActive,
	authorizePermission("ORDER", "READ"),
	getOrdersByUser,
);
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
router.post("/", optionalVerifyToken, addOrderItems);

export default router;