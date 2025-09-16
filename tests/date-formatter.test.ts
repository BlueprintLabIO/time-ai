import { DateFormatter } from '../src/core/date-formatter';
import { TimeContextManager } from '../src/core/time-context';

describe('DateFormatter', () => {
  let formatter: DateFormatter;
  let contextManager: TimeContextManager;

  const testDate = new Date('2025-09-15T15:30:00Z'); // Monday, September 15, 2025 at 3:30 PM UTC

  beforeEach(() => {
    contextManager = new TimeContextManager({
      timezone: 'America/New_York',
      locale: 'en-US'
    });
    formatter = new DateFormatter(contextManager);
  });

  describe('format method', () => {
    it('should format with compact style', () => {
      const result = formatter.format(testDate, 'compact');
      expect(result).toBe('2025-09-15');
    });

    it('should format with ISO style', () => {
      const result = formatter.format(testDate, 'iso');
      expect(result).toContain('2025-09-15T15:30:00.000Z');
    });

    it('should format with human style', () => {
      const result = formatter.format(testDate, 'human');
      expect(result).toContain('September 15, 2025');
    });

    it('should format with context style', () => {
      const result = formatter.format(testDate, 'context');
      expect(result).toContain('September 15, 2025');
    });

    it('should format with hybrid style', () => {
      const result = formatter.format(testDate, 'hybrid');
      // Should either be just relative (if it's a simple date like "today") or include absolute date
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should format with relative style', () => {
      const today = new Date();
      const result = formatter.format(today, 'relative');
      expect(result).toBe('today');
    });

    it('should default to human style for unknown format', () => {
      const result = formatter.format(testDate, 'unknown' as any);
      expect(result).toContain('September 15, 2025');
    });
  });

  describe('formatCompact', () => {
    it('should return YYYY-MM-DD format', () => {
      const result = formatter.format(testDate, 'compact');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2025-09-15');
    });

    it('should handle edge dates correctly', () => {
      const newYearsDay = new Date('2025-01-01T00:00:00Z');
      const newYearsEve = new Date('2025-12-31T23:59:59Z');

      expect(formatter.format(newYearsDay, 'compact')).toBe('2025-01-01');
      expect(formatter.format(newYearsEve, 'compact')).toBe('2025-12-31');
    });
  });

  describe('formatHuman', () => {
    it('should include year, month, and day by default', () => {
      const result = formatter.format(testDate, 'human');
      expect(result).toContain('September');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });

    it('should include weekday when requested', () => {
      const result = formatter.format(testDate, 'human', { includeWeekday: true });
      expect(result).toContain('Monday');
    });

    it('should include time when requested', () => {
      const result = formatter.format(testDate, 'human', { includeTime: true });
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should contain time format
    });

    it('should handle different locales', () => {
      const germanContextManager = new TimeContextManager({
        timezone: 'Europe/Berlin',
        locale: 'de-DE'
      });
      const germanFormatter = new DateFormatter(germanContextManager);

      const result = germanFormatter.format(testDate, 'human');
      // German date format should be different
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatRelative', () => {
    beforeEach(() => {
      // Mock the context manager to return a fixed "now" for consistent testing
      jest.spyOn(contextManager, 'getContext').mockReturnValue({
        now: new Date('2025-09-15T12:00:00Z'),
        timezone: 'America/New_York',
        locale: 'en-US'
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return "today" for current date', () => {
      const today = new Date('2025-09-15T12:00:00Z');
      jest.spyOn(contextManager, 'isToday').mockReturnValue(true);

      const result = formatter.format(today, 'relative');
      expect(result).toBe('today');
    });

    it('should return "tomorrow" for next day', () => {
      const tomorrow = new Date('2025-09-16T12:00:00Z');
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(true);

      const result = formatter.format(tomorrow, 'relative');
      expect(result).toBe('tomorrow');
    });

    it('should return "yesterday" for previous day', () => {
      const yesterday = new Date('2025-09-14T12:00:00Z');
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(-1);

      const result = formatter.format(yesterday, 'relative');
      expect(result).toBe('yesterday');
    });

    it('should return weekday for dates within a week', () => {
      const friday = new Date('2025-09-19T12:00:00Z'); // 4 days from Monday
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(4);
      jest.spyOn(contextManager, 'formatDateInTimezone').mockReturnValue('Friday');

      const result = formatter.format(friday, 'relative');
      expect(result).toContain('Friday');
    });

    it('should return "in X days" for future dates', () => {
      const futureDate = new Date('2025-09-25T12:00:00Z'); // 10 days later
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(20); // Use 20 days to avoid "next Thursday" logic
      jest.spyOn(contextManager, 'formatDateInTimezone').mockReturnValue('Thursday');

      const result = formatter.format(futureDate, 'relative');
      expect(result).toBe('in 20 days');
    });

    it('should return "X days ago" for past dates', () => {
      const pastDate = new Date('2025-09-05T12:00:00Z'); // 10 days ago
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(-10);

      const result = formatter.format(pastDate, 'relative');
      expect(result).toBe('10 days ago');
    });

    it('should handle months for longer periods', () => {
      const futureDate = new Date('2025-12-15T12:00:00Z'); // ~3 months later
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(91);

      const result = formatter.format(futureDate, 'relative');
      expect(result).toMatch(/in \d+ months?/);
    });

    it('should handle years for very long periods', () => {
      const futureDate = new Date('2027-09-15T12:00:00Z'); // 2 years later
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(730);

      const result = formatter.format(futureDate, 'relative');
      expect(result).toMatch(/in \d+ years?/);
    });
  });

  describe('formatContext', () => {
    it('should format context with day reference', () => {
      jest.spyOn(contextManager, 'isToday').mockReturnValue(true);

      const result = formatter.format(testDate, 'context');
      expect(result).toContain('Today');
      expect(result).toContain('September 15, 2025');
    });

    it('should include timezone when requested', () => {
      const result = formatter.format(testDate, 'context', { includeTimezone: true });
      expect(result).toContain('America/New_York');
    });
  });

  describe('formatHybrid', () => {
    it('should combine relative and absolute dates', () => {
      jest.spyOn(contextManager, 'isToday').mockReturnValue(false);
      jest.spyOn(contextManager, 'isTomorrow').mockReturnValue(false);
      jest.spyOn(contextManager, 'getDaysDifference').mockReturnValue(5);

      const result = formatter.format(testDate, 'hybrid');
      expect(result).toContain('2025-09-15');
    });

    it('should not duplicate information', () => {
      jest.spyOn(contextManager, 'isToday').mockReturnValue(true);

      const result = formatter.format(testDate, 'hybrid');
      expect(result).toBe('today');
    });
  });

  describe('formatForLLMContext', () => {
    it('should include current date, weekday, and timezone', () => {
      const result = formatter.formatForLLMContext();

      expect(result).toContain('Current date:');
      expect(result).toContain('Timezone:');
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(result).toContain('America/New_York');
    });

    it('should use provided date', () => {
      const customDate = new Date('2024-01-01T00:00:00Z');
      const result = formatter.formatForLLMContext(customDate);

      expect(result).toContain('2024-01-01');
      // In America/New_York timezone, 2024-01-01T00:00:00Z is still Sunday locally
      expect(result).toContain('Sunday');
    });
  });

  describe('formatDateWithOriginal', () => {
    it('should combine original text with formatted date', () => {
      const result = formatter.formatDateWithOriginal(testDate, 'next Friday');

      expect(result).toContain('next Friday');
      expect(result).toContain('2025-09-15');
    });

    it('should always append absolute date in hybrid strategy', () => {
      const result = formatter.formatDateWithOriginal(testDate, 'next friday');
      expect(result).toBe('next friday (2025-09-15)');
    });
  });

  describe('getTokenCount', () => {
    it('should estimate token count for text', () => {
      const text = 'This is a sample text with multiple words';
      const tokenCount = formatter.getTokenCount(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThan(text.split(' ').length); // Should be less than word count
    });

    it('should handle empty text', () => {
      const tokenCount = formatter.getTokenCount('');
      expect(tokenCount).toBe(0);
    });

    it('should handle single word', () => {
      const tokenCount = formatter.getTokenCount('hello');
      expect(tokenCount).toBeCloseTo(1, 0); // Allow for rounding in the 0.75 multiplier
    });

    it('should be roughly proportional to text length', () => {
      const shortText = 'hello world';
      const longText = 'hello world this is a much longer text with many more words';

      const shortCount = formatter.getTokenCount(shortText);
      const longCount = formatter.getTokenCount(longText);

      expect(longCount).toBeGreaterThan(shortCount);
    });
  });

  describe('timezone handling', () => {
    it('should format dates according to configured timezone', () => {
      const utcFormatter = new DateFormatter(new TimeContextManager({
        timezone: 'UTC',
        locale: 'en-US'
      }));

      const utcResult = utcFormatter.format(testDate, 'human');
      const nyResult = formatter.format(testDate, 'human');

      // Results might be different due to timezone offset
      expect(utcResult).toBeDefined();
      expect(nyResult).toBeDefined();
    });

    it('should handle timezone changes', () => {
      const originalResult = formatter.format(testDate, 'human');

      contextManager.setTimezone('Europe/London');
      const newResult = formatter.format(testDate, 'human');

      expect(originalResult).toBeDefined();
      expect(newResult).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle invalid dates gracefully', () => {
      const invalidDate = new Date('invalid');
      expect(() => formatter.format(invalidDate, 'compact')).toThrow();
    });

    it('should handle very old dates', () => {
      const oldDate = new Date('1900-01-01T00:00:00Z');
      const result = formatter.format(oldDate, 'compact');
      expect(result).toBe('1900-01-01');
    });

    it('should handle very future dates', () => {
      const futureDate = new Date('2100-12-31T23:59:59Z');
      const result = formatter.format(futureDate, 'compact');
      expect(result).toBe('2100-12-31');
    });

    it('should handle leap year dates', () => {
      const leapDate = new Date('2024-02-29T12:00:00Z');
      const result = formatter.format(leapDate, 'compact');
      expect(result).toBe('2024-02-29');
    });
  });
});
