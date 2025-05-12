import { Router, Request, Response, NextFunction } from 'express';
import { 
  register, 
  login, 
  getCurrentUser, 
  getUsers,
  getAdminStats,
  uploadAvatar as uploadAvatarHandler, // Переименовываем импорт
  changePassword
} from '../controllers/userController';
import authMiddleware from '../middlewares/authMiddleware';
import { uploadAvatar } from '../config/multer'; // Middleware для загрузки
import { User } from '../entities/User';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: User;
}

const asyncHandler = <T extends Request>(
  fn: (req: T, res: Response, next?: NextFunction) => Promise<Response | void>
) => (req: T, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Public routes
router.post("/register", asyncHandler<Request>(register));
router.post("/login", asyncHandler<Request>(login));

// Authenticated routes
router.get("/me", authMiddleware, asyncHandler<AuthenticatedRequest>(getCurrentUser));
router.post(
  '/change-password', 
  authMiddleware, 
  asyncHandler<AuthenticatedRequest>(changePassword)
);

// Avatar upload - используем переименованный обработчик
router.post(
  '/upload-avatar',
  authMiddleware,
  uploadAvatar.single('avatar'),
  asyncHandler<AuthenticatedRequest & { file?: Express.Multer.File }>(uploadAvatarHandler) // Используем новое имя
);

// Admin routes
router.get("/", authMiddleware, asyncHandler<AuthenticatedRequest>(getUsers));
router.get(
  "/admin-stats", 
  authMiddleware, 
  asyncHandler<AuthenticatedRequest>(getAdminStats)
);

export default router;