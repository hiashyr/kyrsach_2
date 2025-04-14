import { Router } from "express";
import { 
  register, 
  login, 
  getCurrentUser, 
  getUsers,
  getAdminStats
} from "../controllers/userController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);
router.get("/", authMiddleware, getUsers);
router.get("/admin-stats", authMiddleware, getAdminStats);

export default router;