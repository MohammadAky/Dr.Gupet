# Pet System Backend - Implementation Summary (Complete)

## Status: All 16 Phases Completed

**Total Files:** 100+ | **Total Lines:** ~8000+ | **Commits:** 22

---

## Phase 0 - Bootstrap
NestJS application skeleton with:
- TypeScript strict mode, ESLint, Prettier
- Docker Compose (PostgreSQL 16 + Redis 7)
- Environment validation at startup
- Global prefix `/api/v1`
- Swagger at `/docs` (disabled in production)
- Helmet security, CORS, ValidationPipe

## Phase 1 - Infrastructure & Common Code
Core infrastructure shared by all modules:
- **PrismaModule/PrismaService** - Database connection
- **RedisModule/RedisService** - Cache, OTP, refresh tokens
- **Guards** - JwtAuthGuard (global), RolesGuard
- **Filters** - AllExceptionsFilter, PrismaExceptionFilter, AppException
- **Interceptor** - TransformResponseInterceptor (success envelope)
- **Decorators** - @Public(), @Roles(), @CurrentUser()
- **Utils** - phone normalization, slugify, money, order-number, normalizeFa
- **Constants** - All business limits and thresholds

## Phase 2 - Auth (OTP + JWT)
Phone-based authentication:
- **OTP Service** - HMAC-SHA256 hashed storage, cooldown, rate limits, attempt limits
- **Auth Service** - Request OTP, verify, refresh tokens, logout
- **JWT Strategies** - Access token + refresh token with rotation
- **SMS Service** - Console driver (dev), placeholders for Kavenegar/SmsIr
- **Endpoints** - POST /auth/otp/request, /auth/otp/verify, /auth/refresh, /auth/logout

## Phase 3 - Users & Addresses
User profile and address management:
- **Users Service** - Get/update profile (firstName, lastName, avatar only)
- **Addresses Service** - Full CRUD with default address logic
- **Rules** - Max 10 addresses, first becomes default, ownership checks

## Phase 4 - Upload & Reference Data
File upload and read-only reference data:
- **Upload Service** - Magic bytes validation, UUID filenames, public URLs
- **Pet Types** - List active pet types and breeds (public)
- **Breeds** - List breeds with optional petType filter (public)
- **Tags** - List tags filtered by type ALLERGEN/DIET (public)

## Phase 5 - Pets
Pet management with validation:
- **Pets Service** - Full CRUD with ownership checks
- **Soft Delete** - deletedAt filter on all queries
- **Tags Management** - Replace all tags in transaction
- **Life Stage** - Computed from birthDate (PUPPY_KITTEN/ADULT/SENIOR)
- **Validation** - Breed/type match, birth date, weight range

## Phase 6 - Catalog (Brands, Categories, Products)
Product catalog with filtering:
- **Brands** - List active brands (public)
- **Categories** - Tree structure with child categories (public)
- **Products** - Full filtering, search, sorting, pagination (public)
  - Search with normalized Persian text
  - Filter by petType, category, brand, lifeStage, sizeClass, tags, price, stock
  - Sort by newest, price_asc, price_desc
- **Product Variants** - minPrice denormalized on Product

## Phase 7 - Recommendations
Personalized product recommendations:
- **Algorithm** - Filter by petType, lifeStage, sizeClass, neuterSuitability
- **Allergen Exclusion** - Exclude products with CONTAINS tags matching pet's ALLERGEN tags
- **Ranking** - Number of matching DIET tags (descending), then newest
- **Endpoint** - GET /products/recommendations?petId=<id> (requires auth)

## Phase 8 - Favorites
Favorite products management:
- **Favorites Service** - List, add (idempotent), remove (idempotent)
- **Rules** - Product must be active, inactive filtered from list

## Phase 9 - Cart
Shopping cart with stock validation:
- **Cart Service** - Get, add (merge), update, remove, clear
- **Lazy Creation** - Cart created on first add
- **Stock Validation** - VARIANT_UNAVAILABLE, OUT_OF_STOCK errors
- **Computed Totals** - Prices from current variant (never stored)
- **Availability Flags** - available, stockProblem per item

## Phase 10 - Coupons
Coupon validation and discount:
- **Coupons Service** - validate (preview), evaluate (reusable)
- **Validation Rules** - Invalid, expired, min amount, total/per-user limits
- **Discount Types** - PERCENT (with maxDiscount cap), FIXED
- **Integration** - Used by checkout and validate endpoint

## Phase 11 - Orders & Checkout
Complete checkout flow:
- **Orders Service** - Checkout, list, detail, cancel
- **Order Stock Service** - Atomic reserve/release
- **Checkout Algorithm** (single transaction):
  1. Load cart → CART_EMPTY if empty
  2. Load address → 404 if not owned
  3. Validate items still available
  4. Calculate itemsTotal from variant prices
  5. Validate coupon if provided
  6. Calculate shipping (flat or free above threshold)
  7. Reserve stock atomically
  8. Create order (PENDING_PAYMENT) with orderNumber
  9. Create order items (snapshots)
  10. Record coupon redemption if used
  11. Clear cart items
- **Expiry Job** - Cron every 5 minutes, expires old pending orders

## Phase 12 - Payments
Payment gateway integration:
- **PaymentGateway Interface** - request, verify
- **Mock Gateway** - For development/testing
- **Zarinpal Gateway** - Placeholder for production
- **Callback Controller** - Handles gateway redirect, idempotent
- **SMS Notification** - On successful payment

## Phase 13 - Medicines & Pharmacies
Information-only listing:
- **Medicines** - List and detail with pharmacies
- **Pharmacies** - List and detail with filtering
- **Search** - Persian normalization (ي/ی, ك/ک)
- **Disclaimer** - Included in medicine detail
- **All endpoints public** - No price, no stock, no ordering

## Phase 14 - Seed & Admin Tooling
Idempotent seed script:
- Pet types (dog, cat), 10 breeds each
- 9 allergen tags, 8 diet tags
- 5 brands with sample products and variants
- Sample coupons (PERCENT, FIXED)
- Sample pharmacies and medicines
- Admin user

## Phase 15 - Hardening & Delivery
Production readiness:
- **Dockerfile** - Multi-stage build (builder + production)
- **Security** - Helmet, CORS whitelist, rate limiting
- **Swagger** - Disabled in production
- **Environment** - All vars validated at startup

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | Public | Health check |
| POST | /auth/otp/request | Public | Request OTP |
| POST | /auth/otp/verify | Public | Verify OTP |
| POST | /auth/refresh | Public | Refresh token |
| POST | /auth/logout | User | Logout |
| GET | /users/me | User | Get profile |
| PATCH | /users/me | User | Update profile |
| GET | /addresses | User | List addresses |
| POST | /addresses | User | Create address |
| PATCH | /addresses/:id | User | Update address |
| PATCH | /addresses/:id/default | User | Set default |
| DELETE | /addresses/:id | User | Delete address |
| POST | /upload/image | User | Upload image |
| GET | /pet-types | Public | List pet types |
| GET | /pet-types/:id/breeds | Public | List breeds |
| GET | /breeds | Public | List breeds |
| GET | /tags | Public | List tags |
| GET | /pets | User | List my pets |
| POST | /pets | User | Create pet |
| GET | /pets/:id | User | Get pet |
| PATCH | /pets/:id | User | Update pet |
| PUT | /pets/:id/tags | User | Set pet tags |
| DELETE | /pets/:id | User | Delete pet |
| GET | /brands | Public | List brands |
| GET | /categories | Public | List categories |
| GET | /products | Public | List products |
| GET | /products/recommendations | User | Get recommendations |
| GET | /products/:slug | Public | Product detail |
| GET | /favorites | User | List favorites |
| PUT | /favorites/:productId | User | Add to favorites |
| DELETE | /favorites/:productId | User | Remove from favorites |
| GET | /cart | User | Get cart |
| POST | /cart/items | User | Add to cart |
| PATCH | /cart/items/:id | User | Update cart item |
| DELETE | /cart/items/:id | User | Remove from cart |
| DELETE | /cart | User | Clear cart |
| POST | /coupons/validate | User | Validate coupon |
| POST | /orders | User | Checkout |
| GET | /orders | User | List orders |
| GET | /orders/:id | User | Get order |
| POST | /orders/:id/cancel | User | Cancel order |
| POST | /payments/start | User | Start payment |
| GET | /payments/callback | Public | Payment callback |
| GET | /medicines | Public | List medicines |
| GET | /medicines/:id | User | Medicine detail |
| GET | /pharmacies | Public | List pharmacies |
| GET | /pharmacies/:id | Public | Pharmacy detail |

---

## Running the Application

```bash
# 1. Start Docker services
docker compose up -d

# 2. Install dependencies
npm install

# 3. Generate Prisma client
npm run prisma:generate

# 4. Run migrations
npm run prisma:migrate

# 5. Seed database
npm run prisma:seed

# 6. Start development server
npm run start:dev

# 7. Access API
# - API: http://localhost:3000/api/v1
# - Swagger: http://localhost:3000/docs
```

---

## Environment Variables

See `.env.example` for all required variables. Key ones:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` - Token secrets
- `OTP_DEV_CODE` - Fixed OTP for development (default: 12345)
- `SMS_DRIVER` - console | kavenegar | smsir
- `PAYMENT_DRIVER` - mock | zarinpal
- `ADMIN_SEED_PHONE` - Admin user phone number