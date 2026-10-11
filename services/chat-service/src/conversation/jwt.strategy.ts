import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
  /** Tenant the user belongs to; absent on tokens issued before tenants existed. */
  tid?: string;
}

export const DEFAULT_TENANT_ID = 'default';

/** The user Passport attaches to the request after `validate` succeeds. */
export interface AuthUser {
  sub: string;
  email: string;
  tenantId: string;
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
    if (payload.type !== 'access') throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email, tenantId: payload.tid ?? DEFAULT_TENANT_ID };
  }
}
