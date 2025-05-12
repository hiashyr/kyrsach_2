import { Router } from 'express';
import { uploadQuestionImage } from '../config/multer';
import QuestionController from '../controllers/questionController';
import { asyncHandler } from '../utils/asyncHandler'; // Добавим asyncHandler

const router = Router();
const controller = new QuestionController();

router.post(
  '/:id/image',
  uploadQuestionImage.single('image'),
  asyncHandler(controller.uploadImage.bind(controller)) // Используем asyncHandler
);

export default router;