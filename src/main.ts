import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import helmet from '@fastify/helmet';
import fastifyCsrf from '@fastify/csrf-protection';
import * as qs from 'qs';
import fastifyCookie from '@fastify/cookie';
import { AllExceptionsFilter, COOKIE_SECRET, PORT } from '@app/utils';
import { WsAdapter } from '@nestjs/platform-ws';
import { ConsoleLogger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import CorsOptions from './app.cors';

async function bootstrap() {
  // Configure comprehensive Winston logging
  const logger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`,
          ),
        ),
      }),
      new winston.transports.File({
        filename: 'error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`,
          ),
        ),
      }),
      new winston.transports.File({
        filename: 'combined.log',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(
            (info) => `${info.timestamp} ${info.level.toUpperCase()}: ${info.message}`,
          ),
        ),
      }),
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
  fastifyAdapter.enableCors(CorsOptions)
  // Create application with better logging
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    { logger: new ConsoleLogger({json: false}) }
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
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useWebSocketAdapter(new WsAdapter(app))
  // Register Fastify plugins with proper error handling
  try {
    await app.register(helmet);
    await app.register(fastifyCsrf);
    await app.register(fastifyCookie, {
      secret: COOKIE_SECRET
    });

  } catch (err) {
    logger.error(`Failed to register Fastify plugins: ${err.message}`);
  }

  // Start the server with proper error handling
  try {
    const port = PORT;
    await app.listen(port, '0.0.0.0');
    logger.log(`Application started successfully on port ${port}`);
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
  }
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err);
});