import { ConfigService } from '@nestjs/config';

/** ConfigService stand-in that reads only the given values (ignores process.env). */
export function fakeConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, fallback?: T) => (values[key] ?? fallback) as T,
  } as unknown as ConfigService;
}

