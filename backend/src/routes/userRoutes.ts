import { Router } from "express";
import { 
  register, 
  login, 
  getCurrentUser, 
  getUsers 
} from "../controllers/userController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Публичные роуты
router.post("/register", register);
router.post("/login", login);

// Защищенные роуты
router.get("/me", authMiddleware, getCurrentUser);
router.get("/", authMiddleware, getUsers);

export default router;