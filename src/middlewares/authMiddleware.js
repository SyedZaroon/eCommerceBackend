import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import { PERMISSIONS } from "../config/roles.js"; 

// 1. Active Status Check Middleware
export const checkUserActive = async (req, res, next) => {
  try {
    const user = await Admin.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (user.status !== "Active") {
      return res.status(403).json({ success: false, message: "Your account is deactivated." });
    }

    req.currentUser = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

// 2. Token Verify Middleware (Authentication)
export const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid or expired token." });
  }
};



// 3. Centralized Permission Middleware (Method 2)
export const authorizePermission = (resource, action) => {
  return (req, res, next) => {
    const userRole = req.currentUser?.role;
    const allowedRoles = PERMISSIONS[resource]?.[action];

    if (!userRole || !allowedRoles?.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action.",
      });
    }

    next();
  };
};