import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import helmet from '@fastify/helmet';
import fastifyCsrf from '@fastify/csrf-protection';
import qs from 'qs';
import { AllExceptionsFilter } from '@app/utils';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      querystringParser: (str) => qs.parse(str),
    }),
  );
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter())
  await app.register(helmet)
  await app.register(fastifyCsrf);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
