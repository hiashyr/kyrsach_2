import { RequestHandler } from 'express';

declare module 'express' {
  export interface RequestHandler {
    (req: Request, res: Response, next: NextFunction): Promise<void> | void;
  }
}