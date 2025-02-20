import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import helmet from '@fastify/helmet';
import fastifyCsrf from '@fastify/csrf-protection';
import * as qs from 'qs';
import { AllExceptionsFilter } from '@app/utils';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap() {
  // Configure comprehensive Winston logging
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          winston.format.colorize(),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level}: ${info.message}`,
          ),
        ),
      }),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' }),
    ],
  });

  // Configure Fastify with proper error handling for query string parsing
  const fastifyAdapter = new FastifyAdapter({
    logger: true, // Enable Fastify's built-in logger
    querystringParser: (str) => {
      try {
        return qs.parse(str);
      } catch (err) {
        logger.error(`Query string parsing failed: ${err.message}`);
        return {};
      }
    },
  });

  // Create application with better logging
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { logger }
  );

  // Global prefix configuration
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  // Add global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    })
  );

  // Configure CORS, exception filter, and security
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  
  // Register Fastify plugins with proper error handling
  try {
    await app.register(helmet);
    await app.register(fastifyCsrf);
  } catch (err) {
    logger.error(`Failed to register Fastify plugins: ${err.message}`);
  }

  // Start the server with proper error handling
  try {
    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`Application started successfully on port ${port}`);
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
});