import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as core from '@actions/core';
import { getBoolInputOrFlag } from '../lib/cli.js';

describe('CLI core functionality', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getBoolInputOrFlag', () => {
    it('returns true when input is "true"', () => {
      vi.spyOn(core, 'getInput').mockReturnValue('true');
      expect(getBoolInputOrFlag('test', '--test')).toBe(true);
    });

    it('returns false when input is "false"', () => {
      vi.spyOn(core, 'getInput').mockReturnValue('false');
      expect(getBoolInputOrFlag('test', '--test')).toBe(false);
    });

    it('returns true when flag is present in argv', () => {
      vi.spyOn(core, 'getInput').mockReturnValue(undefined);
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--test'];
      expect(getBoolInputOrFlag('test', '--test')).toBe(true);
      process.argv = originalArgv;
    });

    it('returns false when flag is not present in argv and input is undefined', () => {
      vi.spyOn(core, 'getInput').mockReturnValue(undefined);
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js'];
      expect(getBoolInputOrFlag('test', '--test')).toBe(false);
      process.argv = originalArgv;
    });

    it('handles case-insensitive input', () => {
      vi.spyOn(core, 'getInput').mockReturnValue('TRUE');
      expect(getBoolInputOrFlag('test', '--test')).toBe(true);
    });

    it('handles empty input', () => {
      vi.spyOn(core, 'getInput').mockReturnValue('');
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js'];
      expect(getBoolInputOrFlag('test', '--test')).toBe(false);
      process.argv = originalArgv;
    });
  });
});
