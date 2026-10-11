import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_PUB = 'REDIS_PUB';
export const REDIS_SUB = 'REDIS_SUB';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_PUB,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Redis(cfg.get<string>('REDIS_URL', 'redis://localhost:6379')),
    },
    {
      provide: REDIS_SUB,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) =>
        new Redis(cfg.get<string>('REDIS_URL', 'redis://localhost:6379')),
    },
  ],
  exports: [REDIS_PUB, REDIS_SUB],
})
export class RedisModule {}
