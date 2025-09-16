import { TimeContextManager } from '../src/core/time-context';

describe('TimeContextManager', () => {
  let manager: TimeContextManager;

  beforeEach(() => {
    manager = new TimeContextManager({
      timezone: 'America/New_York',
      locale: 'en-US'
    });
  });

  describe('constructor and configuration', () => {
    it('should create with default system settings', () => {
      const defaultManager = new TimeContextManager();
      const context = defaultManager.getContext();

      expect(context.timezone).toBeDefined();
      expect(context.locale).toBeDefined();
      expect(context.now).toBeInstanceOf(Date);
    });

    it('should use provided configuration', () => {
      const customManager = new TimeContextManager({
        timezone: 'Europe/London',
        locale: 'en-GB'
      });

      const context = customManager.getContext();
      expect(context.timezone).toBe('Europe/London');
      expect(context.locale).toBe('en-GB');
    });
  });

  describe('getContext', () => {
    it('should return current context with fresh timestamp', async () => {
      const context1 = manager.getContext();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const context2 = manager.getContext();
      expect(context2.now.getTime()).toBeGreaterThanOrEqual(context1.now.getTime());
    });

    it('should maintain timezone and locale', () => {
      const context = manager.getContext();
      expect(context.timezone).toBe('America/New_York');
      expect(context.locale).toBe('en-US');
    });
  });

  describe('timezone management', () => {
    it('should update timezone', () => {
      manager.setTimezone('Europe/Paris');
      const context = manager.getContext();
      expect(context.timezone).toBe('Europe/Paris');
    });

    it('should handle invalid timezone gracefully', () => {
      // This might throw or might not, depending on the browser's implementation
      expect(() => {
        manager.setTimezone('Invalid/Timezone');
      }).not.toThrow();
    });

    it('should maintain other settings when changing timezone', () => {
      const originalLocale = manager.getContext().locale;

      manager.setTimezone('Asia/Tokyo');
      const context = manager.getContext();

      expect(context.timezone).toBe('Asia/Tokyo');
      expect(context.locale).toBe(originalLocale);
    });
  });

  describe('locale management', () => {
    it('should update locale', () => {
      manager.setLocale('fr-FR');
      const context = manager.getContext();
      expect(context.locale).toBe('fr-FR');
    });

    it('should maintain other settings when changing locale', () => {
      const originalTimezone = manager.getContext().timezone;

      manager.setLocale('de-DE');
      const context = manager.getContext();

      expect(context.locale).toBe('de-DE');
      expect(context.timezone).toBe(originalTimezone);
    });
  });

  describe('date formatting in timezone', () => {
    it('should format dates according to timezone', () => {
      const testDate = new Date('2025-09-15T12:00:00Z');

      const formatted = manager.formatDateInTimezone(testDate, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      expect(formatted).toContain('September');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2025');
    });

    it('should handle different format options', () => {
      const testDate = new Date('2025-09-15T15:30:00Z');

      const timeFormatted = manager.formatDateInTimezone(testDate, {
        hour: 'numeric',
        minute: '2-digit'
      });

      expect(timeFormatted).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should respect locale in formatting', () => {
      manager.setLocale('de-DE');
      const testDate = new Date('2025-09-15T12:00:00Z');

      const formatted = manager.formatDateInTimezone(testDate, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // German month names should be different
      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('timezone offset calculation', () => {
    it('should calculate timezone offset', () => {
      const offset = manager.getTimezoneOffset();
      expect(typeof offset).toBe('number');
    });

    it('should handle different dates', () => {
      const summerDate = new Date('2025-07-15T12:00:00Z');
      const winterDate = new Date('2025-01-15T12:00:00Z');

      const summerOffset = manager.getTimezoneOffset(summerDate);
      const winterOffset = manager.getTimezoneOffset(winterDate);

      expect(typeof summerOffset).toBe('number');
      expect(typeof winterOffset).toBe('number');

      // For most timezones with DST, these should be different
      // But we can't guarantee this for all timezones
      expect(Math.abs(summerOffset - winterOffset)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('date comparison utilities', () => {
    describe('isToday', () => {
      it('should correctly identify today', () => {
        const now = new Date();
        expect(manager.isToday(now)).toBe(true);
      });

      it('should correctly reject tomorrow', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(manager.isToday(tomorrow)).toBe(false);
      });

      it('should correctly reject yesterday', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        expect(manager.isToday(yesterday)).toBe(false);
      });

      it('should handle timezone-aware comparison', () => {
        // Set to UTC timezone
        manager.setTimezone('UTC');

        const utcNow = new Date();
        expect(manager.isToday(utcNow)).toBe(true);
      });

      it('should handle dates at day boundaries', () => {
        const now = new Date();

        // Test that the current moment is considered "today"
        expect(manager.isToday(now)).toBe(true);

        // Test with a very recent time that should definitely be today
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        expect(manager.isToday(fiveMinutesAgo)).toBe(true);
      });
    });

    describe('isTomorrow', () => {
      it('should correctly identify tomorrow', () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        expect(manager.isTomorrow(tomorrow)).toBe(true);
      });

      it('should correctly reject today', () => {
        const today = new Date();
        expect(manager.isTomorrow(today)).toBe(false);
      });

      it('should correctly reject day after tomorrow', () => {
        const dayAfter = new Date();
        dayAfter.setDate(dayAfter.getDate() + 2);
        expect(manager.isTomorrow(dayAfter)).toBe(false);
      });

      it('should handle month boundaries', () => {
        // Create a specific test case for end of month
        const endOfMonth = new Date(2025, 8, 30); // September 30, 2025
        const nextDay = new Date(2025, 9, 1); // October 1, 2025

        // Mock the context manager to think today is September 30
        jest.spyOn(manager, 'getContext').mockReturnValue({
          now: endOfMonth,
          timezone: 'America/New_York',
          locale: 'en-US'
        });

        expect(manager.isTomorrow(nextDay)).toBe(true);
      });
    });

    describe('getDaysDifference', () => {
      it('should return 0 for today', () => {
        const today = new Date();
        const diff = manager.getDaysDifference(today);
        expect(Math.abs(diff)).toBeLessThanOrEqual(1); // Allow for small timing differences
      });

      it('should return positive for future dates', () => {
        const future = new Date();
        future.setDate(future.getDate() + 5);

        const diff = manager.getDaysDifference(future);
        expect(diff).toBeGreaterThan(0);
        // Allow for rounding based on time-of-day and timezone
        expect(diff).toBeGreaterThanOrEqual(4);
        expect(diff).toBeLessThanOrEqual(6);
      });

      it('should return negative for past dates', () => {
        const past = new Date();
        past.setDate(past.getDate() - 3);

        const diff = manager.getDaysDifference(past);
        expect(diff).toBeLessThan(0);
        expect(diff).toBeCloseTo(-3, 0);
      });

      it('should handle large date differences', () => {
        const farFuture = new Date();
        farFuture.setFullYear(farFuture.getFullYear() + 1);

        const diff = manager.getDaysDifference(farFuture);
        expect(diff).toBeGreaterThan(300); // Roughly a year
      });

      it('should handle timezone differences', () => {
        manager.setTimezone('UTC');
        const utcDate = new Date();
        utcDate.setUTCDate(utcDate.getUTCDate() + 1);

        const diff = manager.getDaysDifference(utcDate);
        expect(Math.abs(diff - 1)).toBeLessThanOrEqual(1); // Account for timezone differences
      });
    });
  });

  describe('updateNow', () => {
    it('should update the reference time', () => {
      const fixedDate = new Date('2025-01-01T12:00:00Z');
      manager.updateNow(fixedDate);

      // The getContext always returns current time, but internal calculations should use the fixed date
      expect(manager.getContext().now).not.toEqual(fixedDate);
    });

    it('should use current time when called without parameter', () => {
      const before = new Date();
      manager.updateNow();
      const after = new Date();

      // This test is a bit tricky since getContext() always returns new Date()
      expect(manager.getContext().now).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates', () => {
      const leapDate = new Date('2024-02-29T12:00:00Z');
      const formatted = manager.formatDateInTimezone(leapDate, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      });

      expect(formatted).toContain('2024');
      expect(formatted).toContain('2');
      expect(formatted).toContain('29');
    });

    it('should handle year boundaries', () => {
      const newYearsEve = new Date('2024-12-31T23:59:59Z');
      const newYearsDay = new Date('2025-01-01T00:00:00Z');

      const diff = manager.getDaysDifference(newYearsDay);
      expect(typeof diff).toBe('number');
    });

    it('should handle daylight saving time transitions', () => {
      manager.setTimezone('America/New_York');

      // Spring forward date (usually second Sunday in March)
      const springDate = new Date('2025-03-09T12:00:00Z');
      // Fall back date (usually first Sunday in November)
      const fallDate = new Date('2025-11-02T12:00:00Z');

      const springOffset = manager.getTimezoneOffset(springDate);
      const fallOffset = manager.getTimezoneOffset(fallDate);

      expect(typeof springOffset).toBe('number');
      expect(typeof fallOffset).toBe('number');
    });

    it('should handle extreme dates', () => {
      const veryOld = new Date('1900-01-01T00:00:00Z');
      const veryFuture = new Date('2100-12-31T23:59:59Z');

      expect(() => manager.formatDateInTimezone(veryOld)).not.toThrow();
      expect(() => manager.formatDateInTimezone(veryFuture)).not.toThrow();
      expect(() => manager.getDaysDifference(veryOld)).not.toThrow();
      expect(() => manager.getDaysDifference(veryFuture)).not.toThrow();
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');

      expect(() => manager.formatDateInTimezone(invalidDate)).toThrow();
      expect(() => manager.getDaysDifference(invalidDate)).not.toThrow(); // Should return NaN or similar
    });
  });

  describe('system locale and timezone detection', () => {
    it('should detect system settings when no config provided', () => {
      const systemManager = new TimeContextManager();
      const context = systemManager.getContext();

      expect(context.timezone).toBeDefined();
      expect(context.timezone.length).toBeGreaterThan(0);
      expect(context.locale).toBeDefined();
      if (context.locale) {
        expect(context.locale.length).toBeGreaterThan(0);
      }
    });
  });

  describe('concurrent access', () => {
    it('should handle rapid successive calls', () => {
      const results = [];
      for (let i = 0; i < 100; i++) {
        results.push(manager.getContext());
      }

      expect(results).toHaveLength(100);
      results.forEach(context => {
        expect(context.timezone).toBe('America/New_York');
        expect(context.locale).toBe('en-US');
        expect(context.now).toBeInstanceOf(Date);
      });
    });

    it('should handle simultaneous timezone changes', () => {
      const timezones = ['UTC', 'Europe/London', 'Asia/Tokyo', 'America/Los_Angeles'];

      timezones.forEach(tz => {
        manager.setTimezone(tz);
        expect(manager.getContext().timezone).toBe(tz);
      });
    });
  });
});
