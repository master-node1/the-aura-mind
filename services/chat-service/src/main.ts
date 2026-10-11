import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/chat');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('TheAuraLab — Chat Service')
      .setDescription('Manages conversations, messages, and the Socket.IO real-time WebSocket gateway.')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('conversations')
      .build();
    SwaggerModule.setup('api/chat/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Chat service running on port ${process.env.PORT ?? 3000}`);
  if (process.env.NODE_ENV !== 'production') console.log(`Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api/chat/docs`);
}
bootstrap();
