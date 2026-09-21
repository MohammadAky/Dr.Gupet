# Pet System Backend - Changelog

## [Unreleased] - Phase 0, 1, 2, 3, 4, 5, 6, 7 & 8 Implementation

### Added

#### Phase 8: Favorites
**Favorites Module:**
- `src/modules/favorites/favorites.module.ts` - FavoritesModule
- `src/modules/favorites/favorites.service.ts` - FavoritesService with:
  - `findAll()` - List favorites (paginated product cards)
  - `add()` - Add to favorites (idempotent)
  - `remove()` - Remove from favorites (idempotent)
- `src/modules/favorites/favorites.controller.ts` - Favorites endpoints:
  - `GET /favorites` - List my favorites (paginated)
  - `PUT /favorites/:productId` - Add to favorites
  - `DELETE /favorites/:productId` - Remove from favorites

**Rules:**
- Product must exist and be active to add (404 otherwise)
- Add/remove are idempotent (adding twice = ok, removing non-existent = ok)
- Inactive products filtered out from list
- Returns product card shape (same as product list)

---

#### Phase 7: Recommendations
**ProductsRecommendationService:**
- `src/modules/products/products-recommendation.service.ts` - Recommendation engine with:
  - `findForPet()` - Get personalized product recommendations
  - `computeLifeStage()` - Calculate life stage from birthDate
  - `computeSizeClass()` - Calculate size class from weight (dogs only)

**Recommendation Algorithm:**
- Filter by pet's petType
- Life stage matching: PUPPY_KITTEN (<12mo), ADULT, SENIOR (>=84mo), ALL
- Size class matching (dogs only): SMALL (<10kg), MEDIUM (10-25kg), LARGE (>25kg), ALL
- Neuter suitability: if neutered → ANY or NEUTERED_ONLY
- Allergen exclusion: exclude products with CONTAINS tags matching pet's ALLERGEN tags
- Must have at least one in-stock active variant
- Ranking: number of matching DIET tags (descending), then newest

**Endpoint:**
- `GET /products/recommendations?petId=<id>&page&limit` (requires auth)
- Returns product card shape + `matchedTags: string[]` + `matchScore: number`

**Query Parameters:**
- `petId` (required) - Pet ID (must belong to caller)
- `page` (optional, default 1)
- `limit` (optional, default 20)

**Rules:**
- Pet must belong to the authenticated user (404 otherwise)
- Products ranked by number of matching diet tags
- Matched tag names returned for UI display
- Only in-stock products recommended

---

#### Phase 6: Catalog (Brands, Categories, Products)
**Brands Module:**
- `src/modules/brands/brands.module.ts` - BrandsModule
- `src/modules/brands/brands.service.ts` - BrandsService with:
  - `findAll()` - Get all active brands
- `src/modules/brands/brands.controller.ts` - Brands endpoint:
  - `GET /brands` - List all brands (public)

**Categories Module:**
- `src/modules/categories/categories.module.ts` - CategoriesModule
- `src/modules/categories/categories.service.ts` - CategoriesService with:
  - `findAll()` - Get categories as tree (parent → children), optional petType filter
- `src/modules/categories/categories.controller.ts` - Categories endpoint:
  - `GET /categories` - List categories (public, optional ?petTypeId=)

**Products Module:**
- `src/modules/products/products.module.ts` - ProductsModule
- `src/modules/products/products.service.ts` - ProductsService with:
  - `findAll()` - List products with filtering, search, sorting, pagination
  - `findBySlug()` - Get product detail by slug
  - `getChildCategoryIds()` - Recursive category tree helper
- `src/modules/products/product-variants.service.ts` - ProductVariantsService with:
  - `recalculateMinPrice()` - Update product.minPrice to cheapest active variant
- `src/modules/products/products.controller.ts` - Product endpoints:
  - `GET /products` - List products (public, with query params)
  - `GET /products/:slug` - Product detail (public)
  - `GET /products/recommendations` - Placeholder for Phase 7

**Product Query Filters:**
- `q` - Search by name (normalized Persian, case-insensitive)
- `petTypeId` - Filter by pet type
- `categorySlug` - Filter by category (includes children)
- `brandId` - Filter by brand
- `lifeStage` - Filter by life stage (PUPPY_KITTEN, ADULT, SENIOR, ALL)
- `sizeClass` - Filter by size (SMALL, MEDIUM, LARGE, ALL)
- `tagIds` - Comma-separated tag IDs (product must have ALL)
- `minPrice`, `maxPrice` - Price range (matches any variant)
- `inStock` - Only products with stock
- `sort` - newest (default), price_asc, price_desc

**Product Card Shape:**
- id, name, slug, brand, image, minPrice, inStock, lifeStage, sizeClass

**Product Detail Shape:**
- All fields + category, petType, images, variants (with inStock/lowStock), tags

**Rules:**
- Only active products with at least one active variant
- Inactive variants never returned
- Stock numbers hidden (only inStock boolean)
- lowStock flag when stock <= LOW_STOCK_THRESHOLD
- minPrice denormalized on Product (recalculate on variant change)
- Category filter includes child categories recursively

---

#### Phase 5: Pets
**Pets Module:**
- `src/modules/pets/pets.module.ts` - PetsModule
- `src/modules/pets/pets.service.ts` - PetsService with:
  - `findAll()` - List my pets with type, breed, tags
  - `findOne()` - Get pet by ID (ownership check)
  - `create()` - Create pet (max 10, breed/type validation)
  - `update()` - Update pet (ownership check)
  - `setTags()` - Replace all tags in transaction (allergen + diet)
  - `remove()` - Soft delete (set deletedAt)
  - `computeLifeStage()` - Calculate PUPPY_KITTEN/ADULT/SENIOR from birthDate
- `src/modules/pets/pets.controller.ts` - Pet endpoints:
  - `GET /pets` - List my pets
  - `POST /pets` - Create pet
  - `GET /pets/:id` - Get pet by ID
  - `PATCH /pets/:id` - Update pet
  - `PUT /pets/:id/tags` - Set pet tags (replace all)
  - `DELETE /pets/:id` - Soft delete pet

**DTOs:**
- `src/modules/pets/dto/create-pet.dto.ts` - name, petTypeId, breedId, birthDate, gender, isNeutered, weightKg, photo
- `src/modules/pets/dto/update-pet.dto.ts` - Partial update (all fields optional)
- `src/modules/pets/dto/set-pet-tags.dto.ts` - allergenTagIds[], dietTagIds[]

**Rules:**
- Max 10 pets per user
- Breed must belong to specified petType
- Birth date cannot be in future
- Weight between 0.1 and 200 kg
- Soft delete (deletedAt) - queries filter deletedAt: null
- Tags replaced in transaction (delete all, create new)
- Tag IDs validated for correct type (ALLERGEN/DIET)
- Life stage computed from birthDate: <12mo=PUPPY_KITTEN, >=84mo=SENIOR, else=ADULT

---

#### Phase 4: Upload & Reference Data
**Upload Module:**
- `src/upload/upload.module.ts` - UploadModule
- `src/upload/upload.service.ts` - UploadService with:
  - Magic bytes validation (JPEG, PNG, WebP)
  - File size limit (configurable via UPLOAD_MAX_MB)
  - Random UUID filename
  - Public URL generation
- `src/upload/upload.controller.ts` - Upload endpoint:
  - `POST /upload/image` - Upload image (multipart/form-data)

**Pet Types Module:**
- `src/modules/pet-types/pet-types.module.ts` - PetTypesModule
- `src/modules/pet-types/pet-types.service.ts` - PetTypesService with:
  - `findAll()` - Get all active pet types
  - `findBreeds()` - Get breeds for a pet type
- `src/modules/pet-types/pet-types.controller.ts` - Pet type endpoints:
  - `GET /pet-types` - List all active pet types (public)
  - `GET /pet-types/:id/breeds` - List breeds for pet type (public)

**Breeds Module:**
- `src/modules/breeds/breeds.module.ts` - BreedsModule
- `src/modules/breeds/breeds.service.ts` - BreedsService with:
  - `findAll()` - Get all active breeds (optional petType filter)
- `src/modules/breeds/breeds.controller.ts` - Breeds endpoint:
  - `GET /breeds` - List all breeds (public, optional ?petTypeId=)

**Tags Module:**
- `src/modules/tags/tags.module.ts` - TagsModule
- `src/modules/tags/tags.service.ts` - TagsService with:
  - `findAll()` - Get tags filtered by type (ALLERGEN or DIET)
- `src/modules/tags/tags.controller.ts` - Tags endpoint:
  - `GET /tags` - List tags (public, optional ?type=ALLERGEN|DIET)

**Seed Data Required:**
- Pet types: dog (سگ), cat (گربه)
- ~10 breeds each
- Allergen tags: chicken, beef, fish, lamb, wheat/gluten, corn, soy, dairy, egg
- Diet tags: grain-free, weight-control, urinary-care, sensitive-digestion, hypoallergenic, skin-and-coat, joint-care, dental-care

---

#### Phase 3: Users & Addresses
**Users Module:**
- `src/modules/users/users.module.ts` - UsersModule
- `src/modules/users/users.service.ts` - UsersService with:
  - `getProfile()` - Get current user profile
  - `updateProfile()` - Update firstName, lastName, avatar only
- `src/modules/users/users.controller.ts` - User endpoints:
  - `GET /users/me` - Get current profile
  - `PATCH /users/me` - Update profile (phone and role not editable)

**Addresses Module:**
- `src/modules/addresses/addresses.module.ts` - AddressesModule
- `src/modules/addresses/addresses.service.ts` - AddressesService with:
  - `findAll()` - List addresses (default first)
  - `create()` - Create address (first becomes default)
  - `update()` - Update address with ownership check
  - `setDefault()` - Set default (unset others in transaction)
  - `remove()` - Delete address (promote most recent if was default)
- `src/modules/addresses/addresses.controller.ts` - Address endpoints:
  - `GET /addresses` - List my addresses
  - `POST /addresses` - Create address (max 10)
  - `PATCH /addresses/:id` - Update address
  - `PATCH /addresses/:id/default` - Set as default
  - `DELETE /addresses/:id` - Delete address

**DTOs:**
- `src/modules/users/dto/update-profile.dto.ts` - firstName, lastName, avatar
- `src/modules/addresses/dto/create-address.dto.ts` - Full address fields
- `src/modules/addresses/dto/update-address.dto.ts` - Partial address fields

**Rules:**
- Max 10 addresses per user
- First address automatically becomes default
- Default address is always unset for others when changed (transaction)
- When deleting default address, most recent remaining is promoted
- Ownership check on all address operations (404 if not found or not owned)

---

#### Phase 2: Auth (OTP + JWT)
**SMS Module:**
- `src/sms/sms.module.ts` - Global SmsModule
- `src/sms/sms.service.ts` - SmsService with driver pattern:
  - ConsoleSmsDriver (dev only, logs to stdout)
  - KavenegarSmsDriver (placeholder)
  - SmsIrSmsDriver (placeholder)
  - Driver selected via `SMS_DRIVER` env var

**Auth Module:**
- `src/modules/auth/auth.module.ts` - AuthModule with JwtModule and PassportModule
- `src/modules/auth/auth.service.ts` - AuthService with:
  - `requestOtp()` - Generate and send OTP
  - `verifyOtp()` - Verify OTP, upsert user, generate tokens
  - `refreshTokens()` - Rotate refresh tokens
  - `logout()` - Invalidate refresh token
- `src/modules/auth/auth.controller.ts` - Auth endpoints:
  - `POST /auth/otp/request` - Request OTP (throttled: 10/min)
  - `POST /auth/otp/verify` - Verify OTP (throttled: 10/min)
  - `POST /auth/refresh` - Refresh access token
  - `POST /auth/logout` - Logout (requires auth)
- `src/modules/auth/otp.service.ts` - OtpService with:
  - HMAC-SHA256 hashed OTP storage in Redis
  - Cooldown between requests (60s)
  - Hourly rate limit (5/hour)
  - Attempt limit (5 attempts)
  - Timing-safe comparison
  - Dev code support (`OTP_DEV_CODE`)

**JWT Strategies:**
- `src/modules/auth/strategies/jwt.strategy.ts` - JWT validation, user loading, block check
- `src/modules/auth/strategies/jwt-refresh.strategy.ts` - Refresh token validation

**DTOs:**
- `src/modules/auth/dto/request-otp.dto.ts` - Phone validation (09XXXXXXXXX)
- `src/modules/auth/dto/verify-otp.dto.ts` - Phone + code validation
- `src/modules/auth/dto/refresh-token.dto.ts` - Refresh token string

**Token Rules:**
- Access token: `{ sub: userId, role }`, configurable TTL
- Refresh token: `{ sub, jti }`, stored in Redis with TTL
- Token rotation on refresh (delete old, issue new)
- Logout deletes refresh token from Redis

---

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