import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import { PERMISSIONS } from "../config/roles.js"; 
import { getApplication } from "../config/applications.js";

// 1. Active Status Check Middleware
export const checkUserActive = async (req, res, next) => {
  try {
    const application = getApplication(req.get("origin"));
    if (!application) {
      return res.status(403).json({ success: false, message: "Unsupported application." });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    if (!application.roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "This account cannot access this application.",
      });
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
    const application = getApplication(req.get("origin"));
    if (!application) {
      return res.status(403).json({ success: false, message: "Unsupported application." });
    }

    const token = req.cookies[application.cookieName];
    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!application.roles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "This account cannot access this application.",
      });
    }

    req.user = decoded; // { userId, role }
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: "Invalid or expired token." });
  }
};

export const optionalVerifyToken = async (req, res, next) => {
  try {
    const application = getApplication(req.get("origin"));
    if (!application) {
      return res.status(403).json({ success: false, message: "Unsupported application." });
    }

    const token = req.cookies[application.cookieName];
    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!application.roles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "This account cannot access this application.",
      });
    }

    req.user = decoded;
    return next();
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