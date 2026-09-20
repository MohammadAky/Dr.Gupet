import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Security
  app.use(helmet.default());

  // CORS
  const corsOrigins = configService.get<string[]>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Static file serving for uploads
  const uploadDir = configService.get<string>('app.uploadDir');
  app.useStaticAssets(uploadDir, { prefix: '/uploads' });

  // Swagger documentation (disabled in production)
  const nodeEnv = configService.get<string>('app.nodeEnv');
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Pet System API')
      .setDescription('Pet System Backend MVP v1')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Enable shutdown hooks
  app.enableShutdownHooks();

  const port = configService.get<number>('app.port');
  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap();