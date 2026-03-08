import { describe, it, expect } from 'vitest';
import { getGreeting } from '../lib/test-greeting';

describe('getGreeting', () => {
  it('should return default greeting when no name provided', () => {
    expect(getGreeting()).toBe('Hello World!');
  });

  it('should return default greeting when empty string provided', () => {
    expect(getGreeting('')).toBe('Hello World!');
  });

  it('should return default greeting when only whitespace provided', () => {
    expect(getGreeting('   ')).toBe('Hello World!');
  });

  it('should return personalized greeting with name', () => {
    expect(getGreeting('Alice')).toBe('Hello, Alice!');
  });

  it('should trim whitespace from name', () => {
    expect(getGreeting('  Bob  ')).toBe('Hello, Bob!');
  });

  it('should handle special characters in name', () => {
    expect(getGreeting('José')).toBe('Hello, José!');
  });

  it('should handle names with spaces', () => {
    expect(getGreeting('John Doe')).toBe('Hello, John Doe!');
  });
});
