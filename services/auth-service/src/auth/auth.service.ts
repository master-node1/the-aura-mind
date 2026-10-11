import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

/** Tenant for deployments that don't set TENANT_ID; matches the column default. */
export const DEFAULT_TENANT_ID = 'default';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already registered');

    const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existingUsername) throw new ConflictException('Username already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const verification = this.newVerificationToken();
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          hashedPassword,
          personalityArchetype: dto.personalityArchetype ?? 'friend',
          tenantId: this.config.get<string>('TENANT_ID') || DEFAULT_TENANT_ID,
          ...verification.data,
        },
      });
    } catch (error) {
      // Lost a race with a concurrent registration.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email or username already registered');
      }
      throw error;
    }
    await this.sendVerificationEmail(user.email, verification.token);
    return this.sanitizeUser(user);
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationTokenHash: this.hashToken(token) },
    });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
    });
    return { message: 'Email verified' };
  }

  /** Same response whether or not the account exists, so emails can't be enumerated. */
  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.isVerified) {
      const verification = this.newVerificationToken();
      await this.prisma.user.update({ where: { id: user.id }, data: verification.data });
      await this.sendVerificationEmail(user.email, verification.token);
    }
    return { message: 'If the account exists and is unverified, a verification email has been sent' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    if (!user.isActive) throw new UnauthorizedException('Account is deactivated');
    if (this.verificationRequired() && !user.isVerified) throw new ForbiddenException('Email not verified');

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    let user: User | null;
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_SECRET', 'changeme'),
      });
      if (payload.type !== 'refresh') throw new Error('Wrong token type');
      user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid refresh token');
    if (this.verificationRequired() && !user.isVerified) throw new ForbiddenException('Email not verified');

    return this.generateTokens(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  private generateTokens(user: User) {
    const secret = this.config.get<string>('JWT_SECRET', 'changeme');
    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, tid: user.tenantId, type: 'access' },
      { secret, expiresIn: `${this.config.get('JWT_ACCESS_EXPIRE_MINUTES', 30)}m` },
    );
    const refreshToken = this.jwt.sign(
      { sub: user.id, type: 'refresh' },
      { secret, expiresIn: `${this.config.get('JWT_REFRESH_EXPIRE_DAYS', 7)}d` },
    );
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'bearer' };
  }

  private verificationRequired() {
    return this.config.get<string>('REQUIRE_EMAIL_VERIFICATION', 'false') === 'true';
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  /** A random token for the email link; only its hash is stored. */
  private newVerificationToken() {
    const token = randomBytes(32).toString('hex');
    const ttlHours = Number(this.config.get('EMAIL_VERIFICATION_TTL_HOURS')) || 24;
    return {
      token,
      data: {
        emailVerificationTokenHash: this.hashToken(token),
        emailVerificationExpiresAt: new Date(Date.now() + ttlHours * 3600_000),
      },
    };
  }

  /** Mail failures are logged, not thrown: the user can ask for a new link. */
  private async sendVerificationEmail(email: string, token: string) {
    // `||`, not a get() default: compose passes unset variables through as ''.
    const link = new URL(this.config.get<string>('EMAIL_VERIFICATION_URL') || 'http://localhost:3000/verify-email');
    link.searchParams.set('token', token);
    try {
      await this.mail.sendVerificationEmail(email, link.toString());
    } catch (error) {
      this.logger.error(`Verification email failed: ${(error as Error).message}`);
    }
  }

  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped from the response
    const { hashedPassword, emailVerificationTokenHash, emailVerificationExpiresAt, ...safe } = user;
    return safe;
  }
}
