import express from "express";
import { createProductCollection, deleteProductCollection, getAllProductCollection } from "../controllers/productCollectionControllers.js";
import { authorizePermission, checkUserActive, verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router()

router.post("/",   
    verifyToken,
    checkUserActive,
    authorizePermission("COLLECTION", "CREATE"), 
    createProductCollection
);

router.get("/", 
    getAllProductCollection
);

router.delete("/delete/:id",
      verifyToken,
      checkUserActive,
      authorizePermission("COLLECTION", "DELETE"), 
    deleteProductCollection);

export default router;