import { Router } from 'express';
import { db, sellers, offerings } from '../db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { authMiddleware, sellerOnly, AuthRequest } from '../middleware/auth';

const router = Router();

const MILES_TO_DEGREES = 1 / 69.0;
const STALE_THRESHOLD_MINUTES = 15;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get('/active', async (req, res) => {
  try {
    const { lat, lng, radius = '50' } = req.query;
    const userLat = lat ? parseFloat(lat as string) : null;
    const userLng = lng ? parseFloat(lng as string) : null;
    const radiusMiles = parseFloat(radius as string);
    
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
    
    const activeSellers = await db.select()
      .from(sellers)
      .where(
        and(
          eq(sellers.isActive, true),
          gte(sellers.lastLocationUpdate, staleThreshold)
        )
      );
    
    const vendorsWithOfferings = await Promise.all(
      activeSellers.map(async (seller) => {
        const sellerOfferings = await db.select()
          .from(offerings)
          .where(eq(offerings.sellerId, seller.id));
        
        const sellerLat = seller.latitude ? parseFloat(seller.latitude) : null;
        const sellerLng = seller.longitude ? parseFloat(seller.longitude) : null;
        
        let distance = 0;
        if (userLat && userLng && sellerLat && sellerLng) {
          distance = calculateDistance(userLat, userLng, sellerLat, sellerLng);
        }
        
        return {
          id: seller.id,
          sellerId: seller.id,
          latitude: sellerLat,
          longitude: sellerLng,
          timestamp: seller.lastLocationUpdate?.toISOString(),
          seller: {
            businessName: seller.businessName,
            ownerName: seller.ownerName,
            phone: seller.phone,
            description: seller.description,
            offerings: sellerOfferings.map(o => o.name),
          },
          distance,
        };
      })
    );
    
    let filteredVendors = vendorsWithOfferings.filter(v => v.latitude && v.longitude);
    
    if (userLat && userLng) {
      filteredVendors = filteredVendors.filter(v => v.distance <= radiusMiles);
      filteredVendors.sort((a, b) => a.distance - b.distance);
    }
    
    res.json(filteredVendors);
  } catch (error) {
    console.error('Get active sellers error:', error);
    res.status(500).json({ error: 'Failed to get active sellers' });
  }
});

router.get('/profile', authMiddleware, sellerOnly, async (req: AuthRequest, res) => {
  try {
    const [seller] = await db.select()
      .from(sellers)
      .where(eq(sellers.userId, req.userId!))
      .limit(1);
    
    if (!seller) {
      return res.status(404).json({ error: 'Seller profile not found' });
    }
    
    const sellerOfferings = await db.select()
      .from(offerings)
      .where(eq(offerings.sellerId, seller.id));
    
    res.json({
      id: seller.id,
      businessName: seller.businessName,
      ownerName: seller.ownerName,
      phone: seller.phone,
      description: seller.description,
      offerings: sellerOfferings.map(o => o.name),
      isActive: seller.isActive,
      latitude: seller.latitude ? parseFloat(seller.latitude) : null,
      longitude: seller.longitude ? parseFloat(seller.longitude) : null,
      lastLocationUpdate: seller.lastLocationUpdate?.toISOString(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/profile', authMiddleware, sellerOnly, async (req: AuthRequest, res) => {
  try {
    const { businessName, ownerName, phone, description, offerings: newOfferings } = req.body;
    
    const [seller] = await db.select()
      .from(sellers)
      .where(eq(sellers.userId, req.userId!))
      .limit(1);
    
    if (!seller) {
      return res.status(404).json({ error: 'Seller profile not found' });
    }
    
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (businessName) updateData.businessName = businessName;
    if (ownerName) updateData.ownerName = ownerName;
    if (phone) updateData.phone = phone;
    if (description !== undefined) updateData.description = description;
    
    await db.update(sellers)
      .set(updateData)
      .where(eq(sellers.id, seller.id));
    
    if (newOfferings && Array.isArray(newOfferings)) {
      await db.delete(offerings).where(eq(offerings.sellerId, seller.id));
      if (newOfferings.length > 0) {
        await db.insert(offerings).values(
          newOfferings.map((name: string) => ({
            sellerId: seller.id,
            name,
          }))
        );
      }
    }
    
    const sellerOfferings = await db.select()
      .from(offerings)
      .where(eq(offerings.sellerId, seller.id));
    
    const [updatedSeller] = await db.select()
      .from(sellers)
      .where(eq(sellers.id, seller.id))
      .limit(1);
    
    res.json({
      id: updatedSeller.id,
      businessName: updatedSeller.businessName,
      ownerName: updatedSeller.ownerName,
      phone: updatedSeller.phone,
      description: updatedSeller.description,
      offerings: sellerOfferings.map(o => o.name),
      isActive: updatedSeller.isActive,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.patch('/location', authMiddleware, sellerOnly, async (req: AuthRequest, res) => {
  try {
    const { latitude, longitude, isActive } = req.body;
    
    const [seller] = await db.select()
      .from(sellers)
      .where(eq(sellers.userId, req.userId!))
      .limit(1);
    
    if (!seller) {
      return res.status(404).json({ error: 'Seller profile not found' });
    }
    
    const updateData: Record<string, any> = { updatedAt: new Date() };
    
    if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = latitude.toString();
      updateData.longitude = longitude.toString();
      updateData.lastLocationUpdate = new Date();
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
      if (!isActive) {
        updateData.latitude = null;
        updateData.longitude = null;
        updateData.lastLocationUpdate = null;
      }
    }
    
    await db.update(sellers)
      .set(updateData)
      .where(eq(sellers.id, seller.id));
    
    const [updatedSeller] = await db.select()
      .from(sellers)
      .where(eq(sellers.id, seller.id))
      .limit(1);
    
    res.json({
      isActive: updatedSeller.isActive,
      latitude: updatedSeller.latitude ? parseFloat(updatedSeller.latitude) : null,
      longitude: updatedSeller.longitude ? parseFloat(updatedSeller.longitude) : null,
      lastLocationUpdate: updatedSeller.lastLocationUpdate?.toISOString(),
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

export default router;
