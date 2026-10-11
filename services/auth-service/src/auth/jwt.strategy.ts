import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

/** The user Passport attaches to the request after `validate` succeeds. */
export interface AuthUser {
  sub: string;
  email: string;
}

export interface AuthenticatedRequest {
  user: AuthUser;
  headers: { authorization?: string };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'changeme'),
    });
  }

  validate(payload: JwtPayload): AuthUser {
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type');
    return { sub: payload.sub, email: payload.email };
  }
}
