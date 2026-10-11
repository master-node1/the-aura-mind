import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
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
  controllers: [ConversationController],
  providers: [ConversationService, JwtStrategy],
  exports: [JwtModule],
})
export class ConversationModule {}
