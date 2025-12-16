import { Router } from 'express';
import { db, users, sellers, offerings } from '../db';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/stats', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select().from(users);
    const allSellers = await db.select().from(sellers);
    const activeSellers = allSellers.filter(s => s.isActive);
    
    res.json({
      totalUsers: allUsers.length,
      totalSellers: allSellers.length,
      activeSellers: activeSellers.length,
      searcherUsers: allUsers.filter(u => u.userType === 'searcher').length,
      sellerUsers: allUsers.filter(u => u.userType === 'seller').length,
      adminUsers: allUsers.filter(u => u.userType === 'admin').length,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.get('/users', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      userType: users.userType,
      createdAt: users.createdAt,
    }).from(users).orderBy(desc(users.createdAt));
    
    res.json(allUsers);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

router.get('/vendors', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const allSellers = await db.select().from(sellers).orderBy(desc(sellers.createdAt));
    
    const vendorsWithDetails = await Promise.all(
      allSellers.map(async (seller) => {
        const [user] = await db.select({
          email: users.email,
        }).from(users).where(eq(users.id, seller.userId));
        
        const sellerOfferings = await db.select()
          .from(offerings)
          .where(eq(offerings.sellerId, seller.id));
        
        return {
          id: seller.id,
          userId: seller.userId,
          email: user?.email,
          businessName: seller.businessName,
          ownerName: seller.ownerName,
          phone: seller.phone,
          description: seller.description,
          isActive: seller.isActive,
          latitude: seller.latitude ? parseFloat(seller.latitude) : null,
          longitude: seller.longitude ? parseFloat(seller.longitude) : null,
          lastLocationUpdate: seller.lastLocationUpdate,
          offerings: sellerOfferings.map(o => o.name),
          createdAt: seller.createdAt,
        };
      })
    );
    
    res.json(vendorsWithDetails);
  } catch (error) {
    console.error('Admin get vendors error:', error);
    res.status(500).json({ error: 'Failed to get vendors' });
  }
});

router.put('/vendors/:id', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const sellerId = parseInt(req.params.id);
    const { businessName, ownerName, phone, description, isActive } = req.body;
    
    const [updatedSeller] = await db.update(sellers)
      .set({
        businessName,
        ownerName,
        phone,
        description,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(sellers.id, sellerId))
      .returning();
    
    if (!updatedSeller) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    res.json({ message: 'Vendor updated successfully', vendor: updatedSeller });
  } catch (error) {
    console.error('Admin update vendor error:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

router.delete('/vendors/:id', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const sellerId = parseInt(req.params.id);
    
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, sellerId));
    if (!seller) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    await db.delete(offerings).where(eq(offerings.sellerId, sellerId));
    
    await db.delete(sellers).where(eq(sellers.id, sellerId));
    
    await db.delete(users).where(eq(users.id, seller.userId));
    
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Admin delete vendor error:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

router.put('/vendors/:id/toggle-active', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const sellerId = parseInt(req.params.id);
    
    const [seller] = await db.select().from(sellers).where(eq(sellers.id, sellerId));
    if (!seller) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    
    const [updatedSeller] = await db.update(sellers)
      .set({
        isActive: !seller.isActive,
        updatedAt: new Date(),
      })
      .where(eq(sellers.id, sellerId))
      .returning();
    
    res.json({ 
      message: `Vendor ${updatedSeller.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: updatedSeller.isActive,
    });
  } catch (error) {
    console.error('Admin toggle vendor error:', error);
    res.status(500).json({ error: 'Failed to toggle vendor status' });
  }
});

router.delete('/users/:id', authMiddleware, adminOnly, async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.userType === 'seller') {
      const [seller] = await db.select().from(sellers).where(eq(sellers.userId, userId));
      if (seller) {
        await db.delete(offerings).where(eq(offerings.sellerId, seller.id));
        await db.delete(sellers).where(eq(sellers.id, seller.id));
      }
    }
    
    await db.delete(users).where(eq(users.id, userId));
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
