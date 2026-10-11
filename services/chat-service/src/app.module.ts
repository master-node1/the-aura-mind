import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ConversationModule } from './conversation/conversation.module';
import { ChatGateway } from './gateway/chat.gateway';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    // Explicit JwtModule for ChatGateway — not relying on ConversationModule re-export
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
      }),
    }),
    ConversationModule,
  ],
  controllers: [HealthController],
  providers: [ChatGateway],
})
export class AppModule {}
