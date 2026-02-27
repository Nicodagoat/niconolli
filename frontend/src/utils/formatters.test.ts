import { describe, it, expect } from 'vitest';
import { formatTonnes, formatPercentage, scopeLabel, categoryLabel } from './formatters';

describe('formatTonnes', () => {
  it('formats millions with M suffix', () => {
    expect(formatTonnes(1_500_000)).toBe('1.50M');
  });

  it('formats thousands with k suffix', () => {
    expect(formatTonnes(4825.7)).toBe('4.83k');
  });

  it('formats small numbers with 2 decimals', () => {
    expect(formatTonnes(42.567)).toBe('42.57');
  });

  it('formats zero', () => {
    expect(formatTonnes(0)).toBe('0.00');
  });
});

describe('formatPercentage', () => {
  it('formats with 1 decimal and % sign', () => {
    expect(formatPercentage(25.67)).toBe('25.7%');
  });

  it('formats zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });
});

describe('scopeLabel', () => {
  it('returns correct label for scope_1', () => {
    expect(scopeLabel('scope_1')).toBe('Scope 1 (Direct)');
  });

  it('returns correct label for scope_2', () => {
    expect(scopeLabel('scope_2')).toBe('Scope 2 (Energy)');
  });

  it('returns correct label for scope_3', () => {
    expect(scopeLabel('scope_3')).toBe('Scope 3 (Value Chain)');
  });

  it('returns original string for unknown scope', () => {
    expect(scopeLabel('unknown')).toBe('unknown');
  });
});

describe('categoryLabel', () => {
  it('converts underscores to spaces and capitalizes', () => {
    expect(categoryLabel('stationary_combustion')).toBe('Stationary Combustion');
  });

  it('handles category numbers', () => {
    const result = categoryLabel('cat_6_business_travel');
    expect(result).toContain('Business');
    expect(result).toContain('Travel');
  });
});
