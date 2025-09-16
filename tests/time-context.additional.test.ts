import { TimeContextManager } from '../src/core/time-context';

describe('TimeContextManager (additional)', () => {
  it('setTimezone should ignore invalid inputs and keep previous timezone', () => {
    const manager = new TimeContextManager({ timezone: 'UTC', locale: 'en-US' });
    const before = manager.getContext().timezone;
    manager.setTimezone('Invalid/Timezone');
    const after = manager.getContext().timezone;
    expect(after).toBe(before);
  });

  it('updateNow should affect relative calculations (getDaysDifference)', () => {
    const manager = new TimeContextManager({ timezone: 'UTC', locale: 'en-US' });
    const ref = new Date('2025-01-01T00:00:00Z');
    manager.updateNow(ref);

    const target = new Date('2025-01-03T00:00:00Z');
    const diff = manager.getDaysDifference(target);
    // 2 days after fixed now
    expect(diff).toBeGreaterThanOrEqual(1);
    expect(diff).toBeLessThanOrEqual(3);
  });

  it('formatDateInTimezone should fallback gracefully when Intl is unavailable', () => {
    const originalIntl = global.Intl;
    try {
      // Force Intl to be unavailable
      // @ts-ignore
      global.Intl = undefined;
      const manager = new TimeContextManager({ timezone: 'UTC', locale: 'en-US' });
      const d = new Date('2025-09-15T12:34:56Z');
      const formatted = manager.formatDateInTimezone(d);
      // Fallback returns YYYY-MM-DD
      expect(formatted).toBe('2025-09-15');
    } finally {
      global.Intl = originalIntl;
    }
  });
});

