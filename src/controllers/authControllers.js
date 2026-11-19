import User from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { APPLICATIONS, getApplication } from "../config/applications.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 24 * 60 * 60 * 1000,
};

export const loginUser = async (req, res) => {
  try {
    const application = getApplication(req.get("origin"));
    if (!application) {
      return res.status(403).json({ message: "Unsupported application." });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status !== "Active") {
      return res.status(403).json({
        message: "Your account is deactivated.",
      });
    }

    if (!application.roles.includes(user.role)) {
      return res.status(403).json({
        message: "This account cannot sign in to this application.",
      });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie(application.cookieName, token, cookieOptions);

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({ message: "Login successful", user: userResponse });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const application = getApplication(req.get("origin"));
    if (!application) {
      return res.status(403).json({ message: "Unsupported application." });
    }

    const { maxAge, ...clearCookieOptions } = cookieOptions;
    res.clearCookie(application.cookieName, clearCookieOptions);

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const registerCustomer = async (req, res) => {
  try {
    const application = getApplication(req.get("origin"));
    if (application !== APPLICATIONS.client) {
      return res.status(403).json({
        message: "Customer registration is available from the client application only.",
      });
    }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please add all required fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const customer = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "Customer",
      status: "Active",
    });

    const userResponse = customer.toObject();
    delete userResponse.password;
    return res.status(201).json({
      message: "Customer registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Error registering customer:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateAccount = async (req, res) => {
  try {
    if (getApplication(req.get("origin")) !== APPLICATIONS.client) {
      return res.status(403).json({
        message: "Account updates are available from the client application only.",
      });
    }

    const { name, email, currentPassword, newPassword } = req.body;
    if (
      name === undefined &&
      email === undefined &&
      newPassword === undefined
    ) {
      return res.status(400).json({ message: "Provide account details to update." });
    }

    const user = req.currentUser;
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
        return res.status(400).json({ message: "Name must be between 1 and 120 characters." });
      }
      user.name = name.trim();
    }

    if (email !== undefined) {
      if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 254
      ) {
        return res.status(400).json({ message: "Enter a valid email address." });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });
      if (existingUser) {
        return res.status(409).json({ message: "Email address is already in use." });
      }
      user.email = normalizedEmail;
    }

    if (newPassword !== undefined) {
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({
          message: "Enter your current password to set a new password.",
        });
      }
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ message: "Current password is incorrect." });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({
          message: "New password must be at least 8 characters long.",
        });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    const userResponse = user.toObject();
    delete userResponse.password;
    return res.status(200).json({
      message: "Account updated successfully.",
      user: userResponse,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Email address is already in use." });
    }
    console.error("Error updating account:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const alreadylogedin = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user || user.status !== "Active") {
      return res.status(401).json({
        success: false,
        message: "User is not authorized",
      });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
