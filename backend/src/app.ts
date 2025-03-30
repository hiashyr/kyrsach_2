import express from "express";
import { AppDataSource } from "./config/data-source";
import cors from "cors";
import userRoutes from "./routes/userRoutes"; // Импортируем роуты пользователей

const app = express();
const PORT = 5000;

app.use(cors({ 
  origin: "http://localhost:3000"
}));
app.use(express.json());

// Подключаем роуты
app.use("/api/users", userRoutes); // Все пути будут начинаться с /api/users

app.get("/", (req, res) => {
  res.json({ 
    message: "Backend работает!",
    endpoints: {
      users: "/api/users"
    }
  });
});

AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });