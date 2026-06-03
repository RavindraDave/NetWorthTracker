import { describe, it, expect, beforeEach } from 'vitest';
import {
  encryptJSON,
  decryptJSON,
  isEncryptedEnvelope,
  setPassphrase,
  getPassphrase,
  hasPassphrase,
} from '../encryption';

describe('encryption', () => {
  beforeEach(() => {
    setPassphrase(null);
  });

  describe('passphrase session management', () => {
    it('starts with no passphrase', () => {
      expect(hasPassphrase()).toBe(false);
      expect(getPassphrase()).toBeNull();
    });

    it('stores and retrieves a passphrase', () => {
      setPassphrase('correct-horse-battery-staple');
      expect(hasPassphrase()).toBe(true);
      expect(getPassphrase()).toBe('correct-horse-battery-staple');
    });

    it('clears passphrase when set to null', () => {
      setPassphrase('secret');
      setPassphrase(null);
      expect(hasPassphrase()).toBe(false);
    });

    it('reports empty string as no passphrase', () => {
      setPassphrase('');
      expect(hasPassphrase()).toBe(false);
    });
  });

  describe('encryptJSON / decryptJSON round-trip', () => {
    it('round-trips a plain string', async () => {
      const plain = 'hello world';
      const envelope = await encryptJSON(plain, 'passphrase');
      const result = await decryptJSON(envelope, 'passphrase');
      expect(result).toBe(plain);
    });

    it('round-trips a JSON snapshot object', async () => {
      const data = JSON.stringify({ snapshots: [{ id: 's1', month: '2026-01' }] });
      const envelope = await encryptJSON(data, 'my-secure-pass');
      const result = await decryptJSON(envelope, 'my-secure-pass');
      expect(result).toBe(data);
    });

    it('produces different ciphertext each call (random IV/salt)', async () => {
      const plain = 'same input';
      const e1 = await encryptJSON(plain, 'pw');
      const e2 = await encryptJSON(plain, 'pw');
      expect(e1).not.toBe(e2);
      // But both decrypt correctly
      expect(await decryptJSON(e1, 'pw')).toBe(plain);
      expect(await decryptJSON(e2, 'pw')).toBe(plain);
    });

    it('envelope contains expected fields', async () => {
      const envelope = await encryptJSON('test', 'pw');
      const obj = JSON.parse(envelope) as Record<string, unknown>;
      expect(obj.v).toBe(1);
      expect(obj.kdf).toBe('PBKDF2');
      expect(typeof obj.iter).toBe('number');
      expect(typeof obj.salt).toBe('string');
      expect(typeof obj.iv).toBe('string');
      expect(typeof obj.ct).toBe('string');
    });
  });

  describe('decryptJSON error cases', () => {
    it('throws on wrong passphrase', async () => {
      const envelope = await encryptJSON('secret data', 'correct');
      await expect(decryptJSON(envelope, 'wrong')).rejects.toThrow(
        'Decryption failed — wrong passphrase or corrupted backup.'
      );
    });

    it('throws on corrupted ciphertext', async () => {
      const envelope = await encryptJSON('data', 'pw');
      const obj = JSON.parse(envelope) as Record<string, unknown>;
      obj.ct = 'invaliddataXXX==';
      await expect(decryptJSON(JSON.stringify(obj), 'pw')).rejects.toThrow();
    });

    it('throws on malformed JSON', async () => {
      await expect(decryptJSON('not-json', 'pw')).rejects.toThrow(
        'Invalid encrypted backup format.'
      );
    });

    it('throws on unsupported envelope version', async () => {
      const envelope = await encryptJSON('data', 'pw');
      const obj = JSON.parse(envelope) as Record<string, unknown>;
      obj.v = 2;
      await expect(decryptJSON(JSON.stringify(obj), 'pw')).rejects.toThrow(
        'Unsupported encryption envelope version.'
      );
    });
  });

  describe('isEncryptedEnvelope', () => {
    it('returns true for a valid envelope string', async () => {
      const envelope = await encryptJSON('test', 'pw');
      expect(isEncryptedEnvelope(envelope)).toBe(true);
    });

    it('returns false for plain JSON', () => {
      expect(isEncryptedEnvelope(JSON.stringify({ snapshots: [] }))).toBe(false);
    });

    it('returns false for plain text', () => {
      expect(isEncryptedEnvelope('not json at all')).toBe(false);
    });

    it('returns false for partial envelope (missing ct)', () => {
      const partial = JSON.stringify({ v: 1, kdf: 'PBKDF2', salt: 'abc', iv: 'def' });
      expect(isEncryptedEnvelope(partial)).toBe(false);
    });
  });
});
