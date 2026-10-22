import express from "express";
import {
  createUser,
  deleteUser,
  getAllUsers,
  updateUser,
} from "../controllers/adminControllers.js";
import { authorizePermission, checkUserActive, verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/",
  verifyToken,
  checkUserActive,
  authorizePermission("USER", "CREATE"),
  createUser,
);

router.get(
  "/",
  verifyToken,
  checkUserActive,
  authorizePermission("USER", "READ"),
  getAllUsers,
);

router.delete(
  "/delete/:id",
  verifyToken,
  checkUserActive,
  authorizePermission("USER", "DELETE"),
  deleteUser,
);

router.patch(
  "/update/:id",
  verifyToken,
  checkUserActive,
  authorizePermission("USER", "UPDATE"),
  updateUser,
);

export default router;
