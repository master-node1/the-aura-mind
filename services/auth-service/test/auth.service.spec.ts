import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { fakeConfig } from './helpers';

const SECRET = 'test-secret';
const USER_ID = '6f1c2b1e-8a43-4d5c-9b1e-2f3a4b5c6d7e';
const PASSWORD = 'password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

const user = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: USER_ID,
  email: 'jane@example.com',
  username: 'jane',
  hashedPassword: passwordHash,
  isActive: true,
  tenantId: 'default',
  ...overrides,
});

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function setup(config: Record<string, string> = {}) {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() } };
  const jwt = new JwtService({ secret: SECRET });
  const mail = { sendVerificationEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    fakeConfig({ JWT_SECRET: SECRET, ...config }),
    mail as unknown as MailService,
  );
  return { prisma, jwt, mail, service };
}

/** The token in the link most recently passed to the mailer. */
const emailedToken = (mail: { sendVerificationEmail: jest.Mock }) =>
  new URL(mail.sendVerificationEmail.mock.calls.at(-1)[1]).searchParams.get('token') as string;

describe('AuthService', () => {
  describe('register', () => {
    const dto = { email: 'jane@example.com', username: 'jane', password: PASSWORD };

    it('shouldCreateUserWithHashedPasswordAndHideTheHash', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: USER_ID, ...data }));

      const result = await service.register(dto);

      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ email: dto.email, username: 'jane', personalityArchetype: 'friend' });
      expect(data).not.toHaveProperty('id');
      expect(bcrypt.compareSync(PASSWORD, data.hashedPassword as string)).toBe(true);
      expect(result).not.toHaveProperty('hashedPassword');
    });

    it.each([
      ['the configured TENANT_ID', { TENANT_ID: 'shop-1' }, 'shop-1'],
      ['the default tenant when TENANT_ID is unset', {}, 'default'],
      ['the default tenant when compose passes TENANT_ID empty', { TENANT_ID: '' }, 'default'],
    ])('shouldStampNewUsersWith %s', async (_case, config, tenantId) => {
      const { prisma, service } = setup(config);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: USER_ID, ...data }));
      await service.register(dto);
      expect(prisma.user.create.mock.calls[0][0].data.tenantId).toBe(tenantId);
    });

    it('shouldEmailAVerificationLinkAndStoreOnlyTheTokenHash', async () => {
      const { prisma, mail, service } = setup({ EMAIL_VERIFICATION_URL: 'https://app.example.com/verify' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: USER_ID, ...data }));

      const result = await service.register(dto);

      const [to, link] = mail.sendVerificationEmail.mock.calls[0];
      expect(to).toBe(dto.email);
      expect(link).toMatch(/^https:\/\/app\.example\.com\/verify\?token=[0-9a-f]{64}$/);
      const data = prisma.user.create.mock.calls[0][0].data;
      expect(data.emailVerificationTokenHash).toBe(sha256(emailedToken(mail)));
      expect((data.emailVerificationExpiresAt as Date).getTime()).toBeGreaterThan(Date.now());
      expect(result).not.toHaveProperty('emailVerificationTokenHash');
      expect(result).not.toHaveProperty('emailVerificationExpiresAt');
    });

    it('shouldFallBackToDefaultsWhenComposePassesEmptyValues', async () => {
      const { prisma, mail, service } = setup({ EMAIL_VERIFICATION_URL: '', EMAIL_VERIFICATION_TTL_HOURS: '' });
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: USER_ID, ...data }));

      await service.register(dto);

      expect(mail.sendVerificationEmail.mock.calls[0][1]).toMatch(/^http:\/\/localhost:3000\/verify-email\?token=/);
      const expires = prisma.user.create.mock.calls[0][0].data.emailVerificationExpiresAt as Date;
      expect(expires.getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);
    });

    it('shouldStillRegisterWhenTheVerificationEmailFails', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: USER_ID, ...data }));
      mail.sendVerificationEmail.mockRejectedValue(new Error('smtp down'));
      await expect(service.register(dto)).resolves.toHaveProperty('id', USER_ID);
    });

    it('shouldRejectTakenEmailWith409', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValueOnce(user());
      await expect(service.register(dto)).rejects.toThrow('Email already registered');
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('shouldRejectTakenUsernameWith409', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(user());
      await expect(service.register(dto)).rejects.toThrow('Username already taken');
    });

    it('shouldMapConcurrentUniqueViolationTo409', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }),
      );
      await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('shouldRethrowUnexpectedDatabaseErrors', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('connection lost'));
      await expect(service.register(dto)).rejects.toThrow('connection lost');
    });
  });

  describe('login', () => {
    const credentials = { email: 'jane@example.com', password: PASSWORD };

    it('shouldIssueAccessAndRefreshTokensForValidCredentials', async () => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());

      const tokens = await service.login(credentials);

      expect(jwt.verify(tokens.access_token)).toMatchObject({ sub: USER_ID, tid: 'default', type: 'access' });
      expect(jwt.verify(tokens.refresh_token)).toMatchObject({ sub: USER_ID, type: 'refresh' });
    });

    it('shouldPutTheUsersOwnTenantInTheAccessToken', async () => {
      const { prisma, jwt, service } = setup({ TENANT_ID: 'other' });
      prisma.user.findUnique.mockResolvedValue(user({ tenantId: 'shop-1' }));
      const tokens = await service.login(credentials);
      expect(jwt.verify(tokens.access_token)).toMatchObject({ tid: 'shop-1' });
    });

    it.each([
      ['an unknown email', null, PASSWORD],
      ['a wrong password', user(), 'wrong-password'],
    ])('shouldReturn401For %s', async (_case, found, password) => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(found);
      await expect(service.login({ ...credentials, password })).rejects.toThrow('Invalid email or password');
    });

    it('shouldRefuseDeactivatedUser', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user({ isActive: false }));
      await expect(service.login(credentials)).rejects.toThrow('Account is deactivated');
    });

    it('shouldAllowUnverifiedUserByDefault', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user({ isVerified: false }));
      await expect(service.login(credentials)).resolves.toHaveProperty('access_token');
    });

    it('shouldRefuseUnverifiedUserWith403WhenVerificationIsRequired', async () => {
      const { prisma, service } = setup({ REQUIRE_EMAIL_VERIFICATION: 'true' });
      prisma.user.findUnique.mockResolvedValue(user({ isVerified: false }));
      await expect(service.login(credentials)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('shouldAllowVerifiedUserWhenVerificationIsRequired', async () => {
      const { prisma, service } = setup({ REQUIRE_EMAIL_VERIFICATION: 'true' });
      prisma.user.findUnique.mockResolvedValue(user({ isVerified: true }));
      await expect(service.login(credentials)).resolves.toHaveProperty('access_token');
    });
  });

  describe('refresh', () => {
    it('shouldIssueNewTokensForValidRefreshToken', async () => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      await expect(service.refresh(jwt.sign({ sub: USER_ID, type: 'refresh' }))).resolves.toHaveProperty('access_token');
    });

    it.each([
      ['an access token', (jwt: JwtService) => jwt.sign({ sub: USER_ID, type: 'access' })],
      ['a token signed with another secret', () => new JwtService({ secret: 'other' }).sign({ sub: USER_ID, type: 'refresh' })],
      ['garbage', () => 'not-a-jwt'],
    ])('shouldReject %s with 401', async (_case, makeToken) => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      await expect(service.refresh(makeToken(jwt))).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
      ['a deactivated user', user({ isActive: false })],
      ['a deleted user', null],
    ])('shouldReject refresh for %s with 401', async (_case, found) => {
      const { prisma, jwt, service } = setup();
      prisma.user.findUnique.mockResolvedValue(found);
      await expect(service.refresh(jwt.sign({ sub: USER_ID, type: 'refresh' }))).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('shouldRefuseUnverifiedUserWith403WhenVerificationIsRequired', async () => {
      const { prisma, jwt, service } = setup({ REQUIRE_EMAIL_VERIFICATION: 'true' });
      prisma.user.findUnique.mockResolvedValue(user({ isVerified: false }));
      await expect(service.refresh(jwt.sign({ sub: USER_ID, type: 'refresh' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('verifyEmail', () => {
    const TOKEN = 'a'.repeat(64);
    const inAnHour = () => new Date(Date.now() + 3600_000);

    it('shouldMarkUserVerifiedAndClearTheToken', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user({ emailVerificationExpiresAt: inAnHour() }));

      await expect(service.verifyEmail(TOKEN)).resolves.toEqual({ message: 'Email verified' });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { emailVerificationTokenHash: sha256(TOKEN) } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { isVerified: true, emailVerificationTokenHash: null, emailVerificationExpiresAt: null },
      });
    });

    it.each([
      ['an unknown token', null],
      ['an expired token', user({ emailVerificationExpiresAt: new Date(Date.now() - 1000) })],
    ])('shouldReject %s with 400', async (_case, found) => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(found);
      await expect(service.verifyEmail(TOKEN)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    const MESSAGE = { message: 'If the account exists and is unverified, a verification email has been sent' };

    it('shouldIssueAFreshTokenForUnverifiedUser', async () => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user({ isVerified: false }));

      await expect(service.resendVerification('jane@example.com')).resolves.toEqual(MESSAGE);

      const { data } = prisma.user.update.mock.calls[0][0];
      expect(data.emailVerificationTokenHash).toBe(sha256(emailedToken(mail)));
    });

    it.each([
      ['an unknown email', null],
      ['an already verified user', user({ isVerified: true })],
      ['a deactivated user', user({ isVerified: false, isActive: false })],
    ])('shouldAnswerTheSameAndSendNothingFor %s', async (_case, found) => {
      const { prisma, mail, service } = setup();
      prisma.user.findUnique.mockResolvedValue(found);
      await expect(service.resendVerification('jane@example.com')).resolves.toEqual(MESSAGE);
      expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('shouldReturnProfileWithoutPasswordHash', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(user());
      const me = await service.getMe(USER_ID);
      expect(me).toMatchObject({ id: USER_ID, email: 'jane@example.com' });
      expect(me).not.toHaveProperty('hashedPassword');
    });

    it('shouldReturn404ForUnknownUser', async () => {
      const { prisma, service } = setup();
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMe(USER_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
