# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# The openssl CLI is REQUIRED for Prisma engine detection on Alpine:
# without it Prisma warns "failed to detect the libssl/openssl version",
# defaults to openssl-1.1.x engines, and then crashes with
# "Could not parse schema engine response ... \"Error load\"...".
RUN apk add --no-cache openssl

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY prisma ./prisma/
COPY src ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy Prisma schema and generated client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Prisma schema for migrations
COPY prisma ./prisma/

# Create uploads directory
RUN mkdir -p /app/uploads

# Expose port
EXPOSE 3000

# Run prisma migrations and start the application.
# NOTE: all structured data lives in the external MySQL database
# (DATABASE_URL, e.g. mysql://user:pass@mysql:3306/pet_db) — only uploaded
# files (/app/uploads) need a mounted volume. `prisma migrate deploy` applies
# the committed migrations on every boot. The local binary is used (NOT npx)
# so the container never needs network access at startup.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/src/main"]