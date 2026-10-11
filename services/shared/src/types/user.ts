export type PersonalityArchetype = 'friend' | 'mentor' | 'coach' | 'creator' | 'assistant';
export type CommunicationStyle = 'casual' | 'formal' | 'playful' | 'empathetic';

export interface User {
  id: string;
  email: string;
  username: string;
  personalityArchetype: PersonalityArchetype;
  avatarConfig: Record<string, unknown>;
  communicationStyle: CommunicationStyle;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterDto {
  email: string;
  username: string;
  password: string;
  personalityArchetype?: PersonalityArchetype;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}
