import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { CompanionController } from './companion.controller';
import { HealthController } from './health.controller';
import { CompanionService } from './companion.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'changeme'),
      }),
    }),
  ],
  controllers: [HealthController, CompanionController],
  providers: [PrismaService, CompanionService, JwtStrategy],
})
export class AppModule {}
