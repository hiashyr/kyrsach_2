import "dotenv/config";
import express from "express";
import { AppDataSource } from "./config/data-source";
import cors from "cors";
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes";
import examRoutes from './routes/exam.routes';
import questionRoutes from './routes/question.routes'; // Добавляем новый роут
import topicRoutes from './routes/topic.routes'; // Добавляем этот импорт
import path from "path";
import fs from "fs"; // Для создания папок

const app = express();
const PORT = process.env.PORT || 5000;

// Проверка обязательных переменных
if (!process.env.JWT_SECRET || !process.env.FRONTEND_URL) {
  console.error("❌ Ошибка: Отсутствуют обязательные переменные в .env");
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

// Создаем папки для загрузок если их нет
const uploadDirs = [
  path.join(__dirname, '../uploads/avatars'),
  path.join(__dirname, '../uploads/questions')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Статические файлы
app.use('/uploads/avatars', express.static(uploadDirs[0]));
app.use('/uploads/questions', express.static(uploadDirs[1]));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Роуты
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/topics", topicRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "OK",
    message: "Сервер работает",
    uploads: {
      avatars: "/uploads/avatars",
      questions: "/uploads/questions"
    }
  });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ error: "Маршрут не найден" });
});

// Инициализация
AppDataSource.initialize()
  .then(() => {
    console.log("✅ База данных подключена");
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`📁 Папки загрузок созданы: ${uploadDirs.join(', ')}`);
    });
  })
  .catch(error => {
    console.error("❌ Ошибка подключения к БД:", error);
    process.exit(1);
  });