import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
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
  ...overrides,
});

function setup() {
  const prisma = { user: { findUnique: jest.fn(), create: jest.fn() } };
  const jwt = new JwtService({ secret: SECRET });
  const service = new AuthService(prisma as unknown as PrismaService, jwt, fakeConfig({ JWT_SECRET: SECRET }));
  return { prisma, jwt, service };
}

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

      expect(jwt.verify(tokens.access_token)).toMatchObject({ sub: USER_ID, type: 'access' });
      expect(jwt.verify(tokens.refresh_token)).toMatchObject({ sub: USER_ID, type: 'refresh' });
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
