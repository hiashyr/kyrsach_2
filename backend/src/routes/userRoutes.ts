import { Router } from "express";
import { 
  register, 
  login, 
  getCurrentUser, 
  getUsers,
  getAdminStats,
  uploadAvatar, 
  changePassword, 
  avatarUpload
} from "../controllers/userController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Добавьте эту функцию-обёртку
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", authMiddleware, asyncHandler(getCurrentUser));
router.post(
  '/upload-avatar', 
  authMiddleware, 
  avatarUpload.single('avatar'), 
  asyncHandler(uploadAvatar)
);
router.post('/change-password', authMiddleware, asyncHandler(changePassword));
router.get("/", authMiddleware, asyncHandler(getUsers));
router.get("/admin-stats", authMiddleware, asyncHandler(getAdminStats));

export default router;