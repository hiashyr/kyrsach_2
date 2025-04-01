import "dotenv/config";
import express from "express";
import { AppDataSource } from "./config/data-source";
import cors from "cors";
import userRoutes from "./routes/userRoutes";

const app = express();
const PORT = 5000;

// Проверка обязательных переменных окружения
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL ERROR: JWT_SECRET не установлен в .env");
  process.exit(1);
}

app.use(cors({ 
  origin: "http://localhost:3000",
  credentials: true // Для работы с cookie/session при необходимости
}));
app.use(express.json());

// Подключаем роуты
app.use("/api/users", userRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "OK",
    message: "Backend работает!",
    endpoints: {
      users: "/api/users"
    },
    timestamp: new Date().toISOString()
  });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint не найден" });
});

// Инициализация БД и сервера
AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`🔑 JWT секрет: ${process.env.JWT_SECRET ? "установлен" : "отсутствует"}`);
    });
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });