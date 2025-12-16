import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.SESSION_SECRET || 'ice-cream-finder-secret-key';

export interface AuthRequest extends Request {
  userId?: number;
  userType?: string;
}

export function generateToken(userId: number, userType: string): string {
  return jwt.sign({ userId, userType }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: number; userType: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; userType: string };
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.userId = decoded.userId;
  req.userType = decoded.userType;
  next();
}

export function sellerOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userType !== 'seller') {
    return res.status(403).json({ error: 'Seller access required' });
  }
  next();
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userType !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
