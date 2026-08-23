import { describe, expect, it } from 'vitest';
import { emailSchema } from './validation';

describe('emailSchema', () => {
  it('lowercases and trims so login matches the stored row', () => {
    expect(emailSchema.parse('  Jose.Guerrero@Cloudflax.COM ')).toBe('jose.guerrero@cloudflax.com');
  });

  it('accepts an already normalized address unchanged', () => {
    expect(emailSchema.parse('cliente@example.com')).toBe('cliente@example.com');
  });

  it('rejects a malformed address', () => {
    const result = emailSchema.safeParse('no-es-un-email');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Email inválido');
  });

  it('rejects an empty string', () => {
    expect(emailSchema.safeParse('   ').success).toBe(false);
  });
});
