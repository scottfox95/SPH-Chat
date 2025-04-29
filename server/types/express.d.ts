// Type definitions for Express to support multer file uploads
import { Express as ExpressNS } from 'express';

// Augment the Express Request interface to support files from multer
declare global {
  namespace Express {
    interface Request {
      file?: {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      };
      files?: {
        [fieldname: string]: {
          fieldname: string;
          originalname: string;
          encoding: string;
          mimetype: string;
          size: number;
          destination: string;
          filename: string;
          path: string;
          buffer: Buffer;
        }[];
      };
    }
  }
}

export { };