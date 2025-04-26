import "dotenv/config";
import express from "express";
import { AppDataSource } from "./config/data-source";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes";

const app = express();
const PORT = 5000;

// Проверка обязательных переменных окружения
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL ERROR: JWT_SECRET не установлен в .env");
  process.exit(1);
}

// Middleware
app.use(cors({ 
  origin: "http://localhost:3000",
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Логирование входящих запросов (для отладки)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Подключение роутов
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "OK",
    message: "Backend работает!",
    endpoints: {
      users: "/api/users",
      auth: "/api/auth",
      forgot_password: "POST /api/auth/forgot-password"
    },
    timestamp: new Date().toISOString()
  });
});

// Обработчик 404 (должен быть ПОСЛЕДНИМ)
app.use((req, res) => {
  console.error(`⚠️ 404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: "Endpoint не найден",
    available_endpoints: {
      users: "/api/users",
      auth: "/api/auth"
    }
  });
});

// Инициализация БД и сервера
AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log("🔑 JWT секрет:", process.env.JWT_SECRET ? "установлен" : "отсутствует");
      console.log("🛣️ Доступные эндпоинты:");
      
      // Аутентификация
      console.log("  🔐 Аутентификация:");
      console.log("    - POST   /api/auth/forgot-password");
      console.log("    - POST   /api/auth/reset-password");
      console.log("    - GET    /api/auth/verify-email");
      console.log("    - POST   /api/auth/verify-email");
      console.log("    - POST   /api/auth/resend-verification");
      
      // Пользователи
      console.log("  👥 Пользователи:");
      console.log("    - POST   /api/users/register");
      console.log("    - POST   /api/users/login");
      console.log("    - GET    /api/users/me (требуется аутентификация)");
      console.log("    - GET    /api/users (только для админов)");
      console.log("    - GET    /api/users/admin-stats (только для админов)");
      
      // Health check
      console.log("  🩺 Проверка состояния:");
      console.log("    - GET    /");
    });
  })
  .catch((err) => {
    console.error("❌ Database connection error:", err);
    process.exit(1);
  });