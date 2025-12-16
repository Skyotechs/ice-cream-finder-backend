# Ice Cream Finder - Backend API

Express.js + TypeScript backend for the Ice Cream Finder mobile app.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL (via Drizzle ORM)
- **Auth:** JWT tokens + bcrypt password hashing
- **TypeScript** for type safety

## Project Structure

```
backend/
├── db/
│   ├── index.ts          # Database connection
│   └── schema.ts         # Drizzle schema definitions
├── middleware/
│   └── auth.ts           # JWT auth & admin middleware
├── routes/
│   ├── auth.ts           # Login & registration
│   ├── sellers.ts        # Vendor location & profile
│   └── admin.ts          # Admin dashboard API
├── server.ts             # Express app setup
├── start.ts              # Entry point
├── package.json          # Dependencies
└── drizzle.config.ts     # Database migration config
```

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database running

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set environment variables**
   Create `.env` file:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/icecreamfinder
   SESSION_SECRET=your-secret-key-here
   PORT=3001
   ```

3. **Push database schema**
   ```bash
   npm run db:push
   ```

4. **Start server**
   ```bash
   npm start
   ```

Server runs on `http://localhost:3001`

### Test the API

```bash
# Health check
curl http://localhost:3001/api/health

# Register a seller
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seller@example.com",
    "password": "password123",
    "name": "John Doe",
    "businessName": "Sweet Treats",
    "businessDescription": "Best ice cream in town",
    "phoneNumber": "555-0100",
    "iceCreams": ["Vanilla", "Chocolate"]
  }'
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new seller
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user (requires auth)

### Sellers (Vendors)
- `GET /api/sellers/active` - Get all active vendors with locations
- `POST /api/sellers/location` - Update seller location (requires auth)
- `PATCH /api/sellers/profile` - Update seller profile (requires auth)
- `PATCH /api/sellers/status` - Toggle active status (requires auth)

### Admin (requires admin auth)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/vendors` - List all vendors
- `PATCH /api/admin/vendors/:id/status` - Activate/deactivate vendor
- `DELETE /api/admin/vendors/:id` - Delete vendor
- `GET /api/admin/users` - List all users
- `DELETE /api/admin/users/:id` - Delete user

## Database Schema

### Users Table
```typescript
{
  id: serial (primary key)
  email: varchar (unique)
  password: varchar (hashed)
  name: varchar
  userType: varchar ('searcher' | 'seller' | 'admin')
  createdAt: timestamp
}
```

### Sellers Table
```typescript
{
  id: serial (primary key)
  userId: integer (foreign key to users)
  businessName: varchar
  businessDescription: text
  phoneNumber: varchar
  iceCreams: text[] (array of flavors)
  isActive: boolean
  currentLatitude: numeric (optional)
  currentLongitude: numeric (optional)
  lastLocationUpdate: timestamp (optional)
  createdAt: timestamp
  updatedAt: timestamp
}
```

## Authentication

All protected routes require JWT token in Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Token is returned on successful login/registration.

## Deployment

See `../RAILWAY_DEPLOYMENT_GUIDE.md` for deploying to Railway with:
- PostgreSQL database
- Custom domain setup
- Environment configuration
- HTTPS/SSL automatic

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (required)
- `SESSION_SECRET` - JWT signing secret (required)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Admin Setup

1. Register a seller account normally
2. Update user type in database:
   ```sql
   UPDATE users SET user_type = 'admin' WHERE email = 'admin@example.com';
   ```
3. Login - Account tab will show Admin Dashboard

## License

MIT
