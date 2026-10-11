import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AnalyticsController } from './analytics.controller';
import { HealthController } from './health.controller';
import { AnalyticsService } from './analytics.service';
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
  controllers: [HealthController, AnalyticsController],
  providers: [PrismaService, AnalyticsService, JwtStrategy],
})
export class AppModule {}
