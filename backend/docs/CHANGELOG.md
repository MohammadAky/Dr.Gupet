# Pet System Backend - Changelog

## [Unreleased] - Phase 0 & 1 Implementation

### Added

#### Phase 0: Bootstrap
**Configuration Files:**
- `package.json` - All dependencies declared with empty versions (npm resolves latest compatible)
- `tsconfig.json` - TypeScript strict mode, path aliases (@/* → src/*)
- `tsconfig.build.json` - Build-specific config excluding tests
- `nest-cli.json` - NestJS CLI configuration with deleteOutDir
- `eslint.config.mjs` - ESLint with TypeScript ESLint and Prettier
- `.prettierrc` - Prettier formatting (single quotes, trailing commas, 100 width)
- `.gitignore` - Comprehensive ignore patterns for Node.js, IDEs, env files
- `.env.example` - All environment variables documented with defaults
- `docker-compose.yml` - PostgreSQL 16 and Redis 7 services with volumes

**Core Application:**
- `src/main.ts` - Bootstrap with:
  - Global prefix `/api/v1`
  - Helmet security headers
  - CORS from config
  - Global ValidationPipe (whitelist, forbidNonWhitelisted, transform)
  - Static file serving for `/uploads`
  - Swagger at `/docs` (disabled in production)
  - Shutdown hooks enabled
- `src/app.module.ts` - Root module with all global providers
- `src/config/app.config.ts` - App configuration (port, CORS, upload, shipping)
- `src/config/env.validation.ts` - Class-validator based env validation (fail-fast)
- `src/config/jwt.config.ts` - JWT secrets and TTLs
- `src/config/redis.config.ts` - Redis URL
- `src/config/sms.config.ts` - SMS driver configuration
- `src/config/payment.config.ts` - Payment gateway configuration

**Health Module:**
- `src/health/health.controller.ts` - GET /health endpoint
- `src/health/health.module.ts` - Health module

#### Phase 1: Infrastructure & Common Code

**Prisma:**
- `src/prisma/prisma.module.ts` - Global PrismaModule
- `src/prisma/prisma.service.ts` - PrismaService extending PrismaClient with lifecycle hooks

**Redis:**
- `src/redis/redis.module.ts` - Global RedisModule
- `src/redis/redis.service.ts` - RedisService with: get, set(ttl), del, incr, expire, ttl, exists

**Decorators:**
- `src/common/decorators/public.decorator.ts` - @Public() for public routes
- `src/common/decorators/roles.decorator.ts` - @Roles(...roles) for role-based access
- `src/common/decorators/current-user.decorator.ts` - @CurrentUser() for accessing JWT payload

**Guards:**
- `src/common/guards/jwt-auth.guard.ts` - JwtAuthGuard (global, skips @Public routes)
- `src/common/guards/roles.guard.ts` - RolesGuard for @Roles decorator

**Exception Filters:**
- `src/common/filters/all-exceptions.filter.ts` - AllExceptionsFilter with standard error envelope
  - Error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_ERROR
  - Persian error messages, English codes
  - AppException helper class
- `src/common/filters/prisma-exception.filter.ts` - PrismaExceptionFilter
  - P2002 → 409 CONFLICT (unique constraint)
  - P2025 → 404 NOT_FOUND (record not found)
  - P2003 → 400 VALIDATION_ERROR (foreign key constraint)

**Interceptors:**
- `src/common/interceptors/transform-response.interceptor.ts` - TransformResponseInterceptor
  - Success envelope: `{ success: true, data, meta? }`
  - Meta only for paginated responses

**DTOs:**
- `src/common/dto/pagination-query.dto.ts` - PaginationQueryDto (page, limit with skip/take getters)
- `src/common/dto/paginated-response.dto.ts` - PaginatedResponseDto + buildMeta helper

**Utils:**
- `src/common/utils/phone.util.ts` - normalizePhone(): Persian/Arabic digits, +98/0098/98 prefixes → 09XXXXXXXXX
- `src/common/utils/slugify.util.ts` - slugify(): Persian-aware, keeps Persian letters, lowercases Latin
- `src/common/utils/money.util.ts` - tomanToRial(), rialToToman() (1 Toman = 10 Rial)
- `src/common/utils/order-number.util.ts` - generateOrderNumber(): PT-YYMMDD-XXXXXX format
- `src/common/utils/normalize-fa.util.ts` - normalizeFa(): Arabic ی/ك → Persian ی/ک, remove zero-width/tatweel

**Constants:**
- `src/common/constants/index.ts` - All business constants:
  - MAX_ADDRESSES_PER_USER = 10
  - MAX_PETS_PER_USER = 10
  - MAX_CART_ITEM_QTY = 20
  - LOW_STOCK_THRESHOLD = 5
  - PUPPY_KITTEN_MAX_MONTHS = 12
  - SENIOR_MIN_MONTHS = 84
  - DOG_SMALL_MAX_KG = 10
  - DOG_MEDIUM_MAX_KG = 25
  - DEFAULT_PAGE_LIMIT = 20
  - MAX_PAGE_LIMIT = 50
  - MEDICINE_DISCLAIMER (Persian)

**Interfaces:**
- `src/common/interfaces/jwt-payload.interface.ts` - JwtPayload { sub, role }

### Changed
- Updated `src/app.module.ts` to register all global providers (guards, filters, interceptors) and import infrastructure modules

### Technical Decisions
1. **No version numbers in package.json** - Let npm resolve latest compatible versions
2. **Global auth by default** - JwtAuthGuard registered globally via APP_GUARD
3. **Persian error messages** - User-facing messages in Persian, error codes in English
4. **Money as Int (Toman)** - Never use float/Decimal for money
5. **Soft delete** - User and Pet have deletedAt, queries must filter deletedAt: null
6. **Ownership checks** - All user-owned resources must include userId in where clause
7. **Prisma only through PrismaService** - Single PrismaClient instance
8. **Config validation at startup** - env.validation.ts fails fast on missing/invalid vars

---

## Git Commit Guide

### Suggested Commits

```bash
# Commit 1: Configuration & Infrastructure
git add package.json tsconfig.json tsconfig.build.json nest-cli.json eslint.config.mjs .prettierrc .gitignore .env.example docker-compose.yml
git commit -m "chore: add project configuration files (Phase 0)

- package.json with all dependencies (empty versions)
- TypeScript configs with strict mode
- ESLint + Prettier setup
- Docker Compose for PostgreSQL 16 and Redis 7
- Environment variables template"

# Commit 2: Core Application Bootstrap
git add src/main.ts src/app.module.ts src/config/
git commit -m "feat: bootstrap NestJS application (Phase 0)

- Global prefix /api/v1
- Helmet, CORS, ValidationPipe
- Swagger documentation (dev only)
- Static file serving for uploads
- Configuration modules with validation
- Health check endpoint"

# Commit 3: Prisma & Redis Infrastructure
git add src/prisma/ src/redis/
git commit -m "feat: add Prisma and Redis infrastructure (Phase 1)

- Global PrismaModule with PrismaService
- Global RedisModule with RedisService
- Connection lifecycle management"

# Commit 4: Common Decorators & Guards
git add src/common/decorators/ src/common/guards/
git commit -m "feat: add common decorators and guards (Phase 1)

- @Public(), @Roles(), @CurrentUser() decorators
- JwtAuthGuard (global) and RolesGuard"

# Commit 5: Exception Filters & Interceptor
git add src/common/filters/ src/common/interceptors/
git commit -m "feat: add exception filters and response interceptor (Phase 1)

- AllExceptionsFilter with standard error envelope
- PrismaExceptionFilter for Prisma error codes
- TransformResponseInterceptor for success envelope
- AppException helper class"

# Commit 6: DTOs, Utils & Constants
git add src/common/dto/ src/common/utils/ src/common/constants/ src/common/interfaces/
git commit -m "feat: add common DTOs, utilities and constants (Phase 1)

- PaginationQueryDto and PaginatedResponseDto
- Phone normalization, slugify, money utils
- Order number generator
- Persian text normalization
- Business constants
- JwtPayload interface"
```

### Alternative: Single Commit (if preferred)

```bash
git add .
git commit -m "feat: implement Phase 0 & 1 - Bootstrap and Infrastructure

Phase 0: Project bootstrap with NestJS, TypeScript, ESLint, Prettier, Docker
Phase 1: Infrastructure layer - Prisma, Redis, Guards, Filters, Interceptors,
DTOs, Utilities, Constants, and Configuration

- Global auth by default with @Public() escape hatch
- Standardized error/success response envelopes
- Persian error messages with English codes
- Money handling in Toman (Int)
- Soft delete pattern for User/Pet
- Environment validation at startup
"
```

---

## Next Phases Ready

The infrastructure is complete and ready for:
- **Phase 2**: Auth (OTP + JWT) - `src/modules/auth/`, `src/sms/`
- **Phase 3**: Users & Addresses - `src/modules/users/`, `src/modules/addresses/`
- **Phase 4**: Upload & Reference Data - `src/upload/`, `src/modules/pet-types/`, `src/modules/breeds/`, `src/modules/tags/`
- **Phase 5**: Pets - `src/modules/pets/`
- **Phase 6**: Catalog - `src/modules/brands/`, `src/modules/categories/`, `src/modules/products/`
- **Phase 7**: Recommendations - `src/modules/products/products-recommendation.service.ts`
- **Phase 8**: Favorites - `src/modules/favorites/`
- **Phase 9**: Cart - `src/modules/cart/`
- **Phase 10**: Coupons - `src/modules/coupons/`
- **Phase 11**: Orders & Checkout - `src/modules/orders/`
- **Phase 12**: Payments - `src/modules/payments/`
- **Phase 13**: Medicines & Pharmacies - `src/modules/medicines/`, `src/modules/pharmacies/`
- **Phase 14**: Seed & Admin Tooling - `prisma/seed.ts`, `src/admin/`
- **Phase 15**: Hardening & Delivery - Dockerfile, E2E tests