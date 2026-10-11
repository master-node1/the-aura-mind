import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
      }),
    }),
  ],
  controllers: [MemoryController],
  providers: [MemoryService, JwtStrategy],
})
export class MemoryModule {}
