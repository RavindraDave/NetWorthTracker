import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDEK, wrapDEK, unwrapDEK, encryptWithDEK, decryptWithDEK,
  makeVerifier, checkVerifier, generateRecoveryCode, normalizeRecoveryCode,
  setSessionDEK, getSessionDEK, lockSession,
} from '../keyVault';

describe('DEK generation', () => {
  it('produces a 256-bit (44-char base64) key', () => {
    const dek = generateDEK();
    expect(dek).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(atob(dek).length).toBe(32);
  });

  it('produces distinct keys each call', () => {
    expect(generateDEK()).not.toBe(generateDEK());
  });
});

describe('wrap / unwrap (key slots)', () => {
  it('round-trips the DEK through a passphrase', async () => {
    const dek = generateDEK();
    const wrapped = await wrapDEK(dek, 'correct horse battery staple');
    expect(await unwrapDEK(wrapped, 'correct horse battery staple')).toBe(dek);
  });

  it('rejects a wrong passphrase', async () => {
    const dek = generateDEK();
    const wrapped = await wrapDEK(dek, 'right-secret');
    await expect(unwrapDEK(wrapped, 'wrong-secret')).rejects.toThrow();
  });

  it('lets multiple secrets unwrap the same DEK (multi-slot)', async () => {
    const dek = generateDEK();
    const viaPass = await wrapDEK(dek, 'passphrase-1');
    const viaCode = await wrapDEK(dek, 'RECOVERYCODE123');
    expect(await unwrapDEK(viaPass, 'passphrase-1')).toBe(dek);
    expect(await unwrapDEK(viaCode, 'RECOVERYCODE123')).toBe(dek);
  });
});

describe('record encryption with the DEK', () => {
  it('round-trips a record', async () => {
    const dek = generateDEK();
    const plaintext = JSON.stringify({ amount: 123456, note: 'secret' });
    const enc = await encryptWithDEK(dek, plaintext);
    expect(enc).not.toContain('123456');
    expect(await decryptWithDEK(dek, enc)).toBe(plaintext);
  });

  it('fails to decrypt with a different DEK', async () => {
    const enc = await encryptWithDEK(generateDEK(), 'data');
    await expect(decryptWithDEK(generateDEK(), enc)).rejects.toThrow();
  });
});

describe('verifier', () => {
  it('confirms the correct DEK and rejects a wrong one', async () => {
    const dek = generateDEK();
    const verifier = await makeVerifier(dek);
    expect(await checkVerifier(dek, verifier)).toBe(true);
    expect(await checkVerifier(generateDEK(), verifier)).toBe(false);
  });
});

describe('recovery code', () => {
  it('generates a grouped code from the unambiguous alphabet', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[A-Z0-9]{5}(-[A-Z0-9]{5}){4}$/);
    expect(code).not.toMatch(/[ILO01]/); // ambiguous chars excluded
  });

  it('normalises user input (case + separators) for matching', () => {
    expect(normalizeRecoveryCode('a7k2m-xyz 9-8')).toBe('A7K2MXYZ98');
  });
});

describe('session DEK', () => {
  beforeEach(() => lockSession());

  it('stores and clears the session key', () => {
    expect(getSessionDEK()).toBeNull();
    setSessionDEK('abc');
    expect(getSessionDEK()).toBe('abc');
    lockSession();
    expect(getSessionDEK()).toBeNull();
  });
});
