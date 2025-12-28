# AzelaPOS - Chicken Butcher Franchise POS

A production-ready, offline-first POS system for chicken butcher franchises.

## Features

- **Fast POS Billing** with barcode scanner and weighing scale support
- **Customer Management** with contact information and purchase history
- **Inventory Management** with wastage tracking
- **Franchise Ordering** - Purchase Orders from franchise to owner
- **Delivery Module** with driver assignment, OTP verification, and tracking
- **Analytics Dashboards** with sales trends, top items, time heatmaps, and more
- **Offline-First** - Works without internet, syncs when online
- **Role-Based Access** - Owner, Manager, Cashier, Driver roles

## Tech Stack

### Frontend
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Zustand for state management
- Recharts for analytics
- React Hook Form + Zod for forms
- Dexie (IndexedDB) for offline storage

### Backend
- Node.js + Fastify + TypeScript
- Prisma ORM
- PostgreSQL
- BullMQ + Redis (for job queues)
- JWT authentication

## Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+
- Redis (optional, for job queues)

## Setup Instructions

### 1. Clone and Install

```bash
# Install dependencies
pnpm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
createdb azela_pos
```

Or using PostgreSQL client:
```sql
CREATE DATABASE azela_pos;
```

### 3. Environment Variables

Copy `.env.example` to `.env` in the root directory and update with your values:

```bash
cp .env.example .env
```

Update the following variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string (optional)
- `JWT_SECRET` - Secret key for JWT tokens
- `JWT_REFRESH_SECRET` - Secret key for refresh tokens
- `API_PORT` - Port for API server (default: 3001)
- `NEXT_PUBLIC_API_URL` - API URL for frontend

### 4. Database Migration

```bash
# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed database with demo data
pnpm db:seed
```

### 5. Start Development Servers

```bash
# Start both API and Web servers
pnpm dev
```

The API server will run on `http://localhost:3001`
The Web app will run on `http://localhost:3000`

## Test Credentials

After seeding, you can login with:

- **Owner**: Phone: `9999999999`, Password: `owner123`
- **Manager**: Phone: `8888888888`, Password: `manager123`
- **Cashier**: Phone: `7777777777`, Password: `cashier123`
- **Driver**: Phone: `6666666666`, Password: `driver123`

## Project Structure

```
/
├── apps/
│   ├── api/          # Fastify API server
│   └── web/          # Next.js frontend
├── packages/
│   ├── db/           # Prisma schema and client
│   ├── shared/       # Shared types and schemas
│   └── offline/      # Offline sync utilities (Dexie)
└── package.json      # Root package.json
```

## Key Features Implementation

### Weighing Scale Barcode Parsing

The system supports configurable scale barcode formats. Example format:
- Prefix: `22`
- PLU: 5 digits (position 0-4)
- Weight: 5 digits (position 5-9) with 2 decimal places
- Optional: Price encoding

To configure scale barcodes, use the API endpoint /api/v1/scale/config.

### Offline-First Architecture

- All POS actions are stored locally in IndexedDB
- Events are queued and synced when online
- Products and prices are cached locally
- Works completely offline for billing

### Delivery Workflow

1. Create sale → Mark as delivery
2. Assign driver (Manager/Owner)
3. Driver marks "Out for Delivery"
4. OTP verification on delivery
5. Mark as Delivered

### Purchase Order Workflow

1. Franchise creates PO (DRAFT)
2. Submit PO (SUBMITTED)
3. Owner approves/rejects (APPROVED/REJECTED)
4. Owner creates dispatch (DISPATCHED)
5. Franchise receives and creates GRN (RECEIVED)
6. Inventory updated automatically

## Development Commands

```bash
# Install dependencies
pnpm install

# Run development servers
pnpm dev

# Database commands
pnpm db:generate    # Generate Prisma client
pnpm db:migrate     # Run migrations
pnpm db:seed        # Seed database
pnpm db:studio      # Open Prisma Studio

# Build for production
pnpm build

# Type checking
pnpm type-check
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token
- `GET /api/v1/auth/me` - Get current user

### POS
- `GET /api/v1/products` - Get products
- `POST /api/v1/sales` - Create sale
- `POST /api/v1/sales/:id/pay` - Pay sale
- `POST /api/v1/sales/:id/void` - Void sale
- `POST /api/v1/sales/:id/refund` - Refund sale

### Customers
- `GET /api/v1/customers` - List/search customers
- `POST /api/v1/customers` - Create/update customer

### Inventory
- `GET /api/v1/inventory/summary` - Get inventory summary
- `POST /api/v1/inventory/adjust` - Adjust inventory
- `POST /api/v1/inventory/wastage` - Record wastage

### Purchase Orders
- `GET /api/v1/po` - List POs
- `POST /api/v1/po` - Create PO
- `POST /api/v1/po/:id/submit` - Submit PO
- `POST /api/v1/po/:id/approve` - Approve PO
- `POST /api/v1/po/:id/dispatch` - Create dispatch

### Delivery
- `GET /api/v1/delivery` - List deliveries
- `POST /api/v1/delivery` - Create delivery
- `POST /api/v1/delivery/:id/assign-driver` - Assign driver
- `POST /api/v1/delivery/:id/status` - Update status
- `POST /api/v1/delivery/:id/otp/verify` - Verify OTP

### Analytics
- `GET /api/v1/analytics/sales-trend` - Sales trend
- `GET /api/v1/analytics/top-items` - Top items
- `GET /api/v1/analytics/time-heatmap` - Time heatmap
- `GET /api/v1/analytics/payment-mix` - Payment mix
- `GET /api/v1/analytics/delivery-kpis` - Delivery KPIs
- `GET /api/v1/analytics/store-compare` - Store comparison

### Sync (Offline)
- `POST /api/v1/sync/events` - Sync events
- `GET /api/v1/sync/bootstrap` - Bootstrap data

## Production Deployment

1. Build the application:
```bash
pnpm build
```

2. Set production environment variables

3. Run database migrations:
```bash
pnpm db:migrate:deploy
```

4. Start the servers:
```bash
# API
cd apps/api
pnpm start

# Web
cd apps/web
pnpm start
```

## License

Proprietary - All rights reserved

# K2ChickenPOS
