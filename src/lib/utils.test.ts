import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names correctly', () => {
    const result = cn('px-4', 'py-2', 'text-sm');
    expect(result).toBe('px-4 py-2 text-sm');
  });

  it('handles conditional classes (clsx behavior)', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
    expect(result).not.toContain('disabled');
  });

  it('resolves Tailwind conflicts (last one wins)', () => {
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });

  it('resolves conflicting Tailwind color classes', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('handles empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('handles arrays and objects (clsx feature)', () => {
    const result = cn(['px-4', 'py-2'], { 'font-bold': true, italic: false });
    expect(result).toContain('px-4');
    expect(result).toContain('py-2');
    expect(result).toContain('font-bold');
    expect(result).not.toContain('italic');
  });
});
