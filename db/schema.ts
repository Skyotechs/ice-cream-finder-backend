import { pgTable, serial, varchar, text, boolean, timestamp, decimal, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  userType: varchar('user_type', { length: 20 }).notNull().default('searcher'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull().unique(),
  businessName: varchar('business_name', { length: 255 }).notNull(),
  ownerName: varchar('owner_name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(false).notNull(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp('last_location_update'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const offerings = pgTable('offerings', {
  id: serial('id').primaryKey(),
  sellerId: integer('seller_id').references(() => sellers.id).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const usersRelations = relations(users, ({ one }) => ({
  seller: one(sellers, {
    fields: [users.id],
    references: [sellers.userId],
  }),
}));

export const sellersRelations = relations(sellers, ({ one, many }) => ({
  user: one(users, {
    fields: [sellers.userId],
    references: [users.id],
  }),
  offerings: many(offerings),
}));

export const offeringsRelations = relations(offerings, ({ one }) => ({
  seller: one(sellers, {
    fields: [offerings.sellerId],
    references: [sellers.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Seller = typeof sellers.$inferSelect;
export type NewSeller = typeof sellers.$inferInsert;
export type Offering = typeof offerings.$inferSelect;
export type NewOffering = typeof offerings.$inferInsert;
