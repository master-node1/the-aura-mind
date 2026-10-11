import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { MemoryModule } from './memory/memory.module';
import { RedisModule } from './redis/redis.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    MemoryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
