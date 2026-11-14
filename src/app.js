import express from "express";
import cors from "cors";
import cookieParser from 'cookie-parser';
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import productCollectionRoutes from "./routes/productCollectionRoutes.js";
import authRoutes from "./routes/authRoutes.js";

export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());


app.use("/api/users", userRoutes);

app.use("/api/products", productRoutes);

app.use("/api/productcollection", productCollectionRoutes )

app.use("/api", authRoutes)

