import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, users, sellers, offerings } from '../db';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, businessName, ownerName, phone, description, offerings: offeringsList } = req.body;
    
    if (!email || !password || !businessName || !ownerName || !phone) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [newUser] = await db.insert(users).values({
      email,
      password: hashedPassword,
      userType: 'seller',
    }).returning();
    
    const [newSeller] = await db.insert(sellers).values({
      userId: newUser.id,
      businessName,
      ownerName,
      phone,
      description: description || '',
    }).returning();
    
    if (offeringsList && Array.isArray(offeringsList) && offeringsList.length > 0) {
      await db.insert(offerings).values(
        offeringsList.map((name: string) => ({
          sellerId: newSeller.id,
          name,
        }))
      );
    }
    
    const token = generateToken(newUser.id, 'seller');
    
    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        userType: 'seller',
        seller: {
          id: newSeller.id,
          businessName: newSeller.businessName,
          ownerName: newSeller.ownerName,
          phone: newSeller.phone,
          description: newSeller.description,
          offerings: offeringsList || [],
          isActive: newSeller.isActive,
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user.id, user.userType);
    
    let sellerData = null;
    if (user.userType === 'seller') {
      const [seller] = await db.select().from(sellers).where(eq(sellers.userId, user.id)).limit(1);
      if (seller) {
        const sellerOfferings = await db.select().from(offerings).where(eq(offerings.sellerId, seller.id));
        sellerData = {
          id: seller.id,
          businessName: seller.businessName,
          ownerName: seller.ownerName,
          phone: seller.phone,
          description: seller.description,
          offerings: sellerOfferings.map(o => o.name),
          isActive: seller.isActive,
          latitude: seller.latitude ? parseFloat(seller.latitude) : null,
          longitude: seller.longitude ? parseFloat(seller.longitude) : null,
        };
      }
    }
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        userType: user.userType,
        seller: sellerData,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let sellerData = null;
    if (user.userType === 'seller') {
      const [seller] = await db.select().from(sellers).where(eq(sellers.userId, user.id)).limit(1);
      if (seller) {
        const sellerOfferings = await db.select().from(offerings).where(eq(offerings.sellerId, seller.id));
        sellerData = {
          id: seller.id,
          businessName: seller.businessName,
          ownerName: seller.ownerName,
          phone: seller.phone,
          description: seller.description,
          offerings: sellerOfferings.map(o => o.name),
          isActive: seller.isActive,
          latitude: seller.latitude ? parseFloat(seller.latitude) : null,
          longitude: seller.longitude ? parseFloat(seller.longitude) : null,
        };
      }
    }
    
    res.json({
      id: user.id,
      email: user.email,
      userType: user.userType,
      seller: sellerData,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

export default router;
