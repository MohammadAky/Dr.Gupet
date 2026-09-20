import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  uploadMaxMb: parseInt(process.env.UPLOAD_MAX_MB || '5', 10),
  shippingFlatCost: parseInt(process.env.SHIPPING_FLAT_COST || '50000', 10),
  freeShippingThreshold: parseInt(process.env.FREE_SHIPPING_THRESHOLD || '1500000', 10),
  orderExpireMinutes: parseInt(process.env.ORDER_EXPIRE_MINUTES || '30', 10),
}));
