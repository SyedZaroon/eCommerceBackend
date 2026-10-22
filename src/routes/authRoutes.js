import express from "express";
import { loginUser, logoutUser, alreadylogedin } from "../controllers/authControllers.js";
import { checkUserActive, verifyToken } from "../middlewares/authMiddleware.js";



const router = express.Router();

router.post("/login",  loginUser);
router.post("/logout", logoutUser);

router.get("/me",  verifyToken, checkUserActive, alreadylogedin )

export default router;