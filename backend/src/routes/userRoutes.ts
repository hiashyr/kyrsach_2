import { Router, Request, Response, NextFunction } from 'express';
import { 
  register, 
  login, 
  getCurrentUser, 
  getUsers,
  getAdminStats,
  uploadAvatar, 
  changePassword
} from '../controllers/userController';
import authMiddleware from '../middlewares/authMiddleware';
import { upload } from '../config/multer';
import { User } from '../entities/User';

const router = Router();

// Расширенный тип Request с пользователем
interface AuthenticatedRequest extends Request {
  user?: User;
}

// Универсальный asyncHandler с правильной типизацией
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

// Avatar upload
router.post(
  '/upload-avatar',
  authMiddleware,
  upload.single('avatar'),
  asyncHandler<AuthenticatedRequest & { file?: Express.Multer.File }>(uploadAvatar)
);

// Admin routes
router.get("/", authMiddleware, asyncHandler<AuthenticatedRequest>(getUsers));
router.get(
  "/admin-stats", 
  authMiddleware, 
  asyncHandler<AuthenticatedRequest>(getAdminStats)
);

export default router;