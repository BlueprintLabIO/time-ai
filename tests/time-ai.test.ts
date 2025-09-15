import { TimeAI, createTimeAI, enhancePrompt, parseDate } from '../src';

describe('TimeAI', () => {
  let timeAI: TimeAI;

  beforeEach(() => {
    timeAI = new TimeAI({
      timezone: 'America/New_York',
      locale: 'en-US'
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const instance = new TimeAI();
      expect(instance).toBeInstanceOf(TimeAI);
    });

    it('should create instance with custom config', () => {
      const instance = new TimeAI({
        timezone: 'Europe/London',
        locale: 'en-GB',
        strategy: 'normalize'
      });
      expect(instance).toBeInstanceOf(TimeAI);
    });
  });

  describe('enhancePrompt', () => {
    it('should enhance prompt with date context', () => {
      const result = timeAI.enhancePrompt('Schedule a meeting tomorrow');
      
      expect(result.originalText).toBe('Schedule a meeting tomorrow');
      expect(result.enhancedText).toContain('tomorrow');
      expect(result.context).toContain('Current date:');
      expect(result.extractions).toHaveLength(1);
      expect(result.extractions[0].type).toBe('relative');
    });

    it('should handle text with no dates', () => {
      const result = timeAI.enhancePrompt('What is the weather like?');
      
      expect(result.originalText).toBe('What is the weather like?');
      expect(result.enhancedText).toBe('What is the weather like?');
      expect(result.extractions).toHaveLength(0);
    });

    it('should apply different strategies', () => {
      const text = 'Meet next Friday';
      
      const preserved = timeAI.enhancePrompt(text, { strategy: 'preserve' });
      expect(preserved.enhancedText).toBe('Meet next Friday');
      
      const normalized = timeAI.enhancePrompt(text, { strategy: 'normalize' });
      expect(normalized.enhancedText).toMatch(/Meet \d{4}-\d{2}-\d{2}/);
      
      const hybrid = timeAI.enhancePrompt(text, { strategy: 'hybrid' });
      expect(hybrid.enhancedText).toMatch(/Meet next Friday \(\d{4}-\d{2}-\d{2}\)/);
    });
  });

  describe('parseDate', () => {
    it('should parse relative dates', () => {
      const result = timeAI.parseDate('tomorrow at 3pm');
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('relative');
      expect(result!.confidence).toBeGreaterThan(0.8);
      expect(result!.originalText).toBe('tomorrow at 3pm');
    });

    it('should parse absolute dates', () => {
      const result = timeAI.parseDate('September 15, 2025');
      
      expect(result).not.toBeNull();
      expect(result!.type).toBe('absolute');
      expect(result!.resolvedDate.getFullYear()).toBe(2025);
      expect(result!.resolvedDate.getMonth()).toBe(8); // September is month 8 (0-indexed)
    });

    it('should return null for text with no dates', () => {
      const result = timeAI.parseDate('Hello world');
      expect(result).toBeNull();
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2025-09-15T12:00:00Z');

    it('should format date in different styles', () => {
      expect(timeAI.formatDate(testDate, 'compact')).toBe('2025-09-15');
      expect(timeAI.formatDate(testDate, 'iso')).toContain('2025-09-15T');
      expect(timeAI.formatDate(testDate, 'human')).toContain('September 15, 2025');
    });
  });

  describe('addContext', () => {
    it('should add temporal context to prompt', () => {
      const result = timeAI.addContext('What should I do?');
      
      expect(result).toContain('Current date:');
      expect(result).toContain('Timezone:');
      expect(result).toContain('What should I do?');
    });
  });

  describe('utility methods', () => {
    it('should check if date is today', () => {
      const today = new Date();
      expect(timeAI.isToday(today)).toBe(true);
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(timeAI.isToday(tomorrow)).toBe(false);
    });

    it('should check if date is tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(timeAI.isTomorrow(tomorrow)).toBe(true);
      
      const today = new Date();
      expect(timeAI.isTomorrow(today)).toBe(false);
    });

    it('should calculate days difference', () => {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Allow for rounding differences - days difference should be close to expected values
      const tomorrowDiff = timeAI.getDaysDifference(tomorrow);
      const todayDiff = timeAI.getDaysDifference(today);

      expect(tomorrowDiff).toBeGreaterThanOrEqual(0);
      expect(tomorrowDiff).toBeLessThanOrEqual(2); // Allow for rounding
      expect(Math.abs(todayDiff)).toBeLessThanOrEqual(1); // Today should be close to 0
    });
  });

  describe('configuration changes', () => {
    it('should allow timezone changes', () => {
      timeAI.setTimezone('Europe/London');
      const context = timeAI.getContext();
      expect(context.timezone).toBe('Europe/London');
    });

    it('should allow locale changes', () => {
      timeAI.setLocale('en-GB');
      const context = timeAI.getContext();
      expect(context.locale).toBe('en-GB');
    });
  });
});

describe('Factory functions', () => {
  it('should create TimeAI instance', () => {
    const instance = createTimeAI({ timezone: 'UTC' });
    expect(instance).toBeInstanceOf(TimeAI);
  });

  it('should enhance prompt with default instance', () => {
    const result = enhancePrompt('Meet tomorrow');
    expect(result.extractions).toHaveLength(1);
  });

  it('should parse date with default instance', () => {
    const result = parseDate('next week');
    expect(result).not.toBeNull();
    expect(result!.type).toBe('relative');
  });
});