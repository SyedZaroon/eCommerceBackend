import dotenv from "dotenv";
import { app } from "./src/app.js";
import { connectDB } from "./src/config/db.js";

dotenv.config();


connectDB().then(() => {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
}); 