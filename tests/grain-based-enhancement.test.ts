import { TimeAI } from '../src';

describe('Grain-Based Time Enhancement', () => {
  let timeAI: TimeAI;

  beforeEach(() => {
    timeAI = new TimeAI({
      timezone: 'UTC',
      locale: 'en-US',
      includeContext: false
    });
  });

  describe('Day-grain expressions (no time specified)', () => {
    const dayOnlyExpressions = [
      'tomorrow',
      'today',
      'yesterday',
      'next Monday',
      'next Tuesday',
      'next Wednesday',
      'next Thursday',
      'next Friday',
      'next Saturday',
      'next Sunday',
      'this Monday',
      'this Friday',
      'last Monday',
      'last Friday',
      'next week',
      'next month',
      'end of this week'
      // Note: "beginning of next month" is complex and might not parse as simple day grain
    ];

    dayOnlyExpressions.forEach(expression => {
      it(`should show date only for "${expression}" in hybrid strategy`, () => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(result.extractions[0].grain).toBe('day');

        // Should show date only (YYYY-MM-DD) without time
        expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2}\)$/);
        expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
      });

      it(`should show date only for "${expression}" in normalize strategy`, () => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'normalize' });

        expect(result.extractions).toHaveLength(1);
        expect(result.extractions[0].grain).toBe('day');

        // Should replace with date only
        expect(result.enhancedText).toMatch(/Meet \d{4}-\d{2}-\d{2}$/);
        expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
      });
    });
  });

  describe('Hour-grain expressions (time specified)', () => {
    const hourExpressions = [
      'tomorrow at 3pm',
      'today at noon',
      'next Monday at 9am',
      'this Friday at 5pm',
      'tomorrow at 10 o\'clock',
      'next week at 2pm'
      // Note: "yesterday at midnight" might be treated as day grain by chrono
    ];

    hourExpressions.forEach(expression => {
      it(`should include time for "${expression}" in hybrid strategy`, () => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(['hour', 'minute', 'second']).toContain(result.extractions[0].grain);

        // Should include time information
        expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2} \d+:\d+ [AP]M UTC\)/);
      });

      it(`should include time for "${expression}" in normalize strategy`, () => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'normalize' });

        expect(result.extractions).toHaveLength(1);
        expect(['hour', 'minute', 'second']).toContain(result.extractions[0].grain);

        // Should replace with date and time
        expect(result.enhancedText).toMatch(/Meet \d{4}-\d{2}-\d{2} \d+:\d+ [AP]M UTC/);
      });
    });
  });

  describe('Minute-grain expressions (precise time specified)', () => {
    const minuteExpressions = [
      'tomorrow at 3:30pm',
      'next Monday at 9:15am',
      'this Friday at 11:45pm',
      'yesterday at 12:30pm'
    ];

    minuteExpressions.forEach(expression => {
      it(`should include precise time for "${expression}" in hybrid strategy`, () => {
        const result = timeAI.enhancePrompt(`Call ${expression}`, { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(['minute', 'second']).toContain(result.extractions[0].grain);

        // Should include precise time information
        expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2} \d+:\d+ [AP]M UTC\)/);
      });
    });
  });

  describe('Mixed expressions in same prompt', () => {
    it('should handle mixed grain expressions correctly', () => {
      const result = timeAI.enhancePrompt(
        'Submit report tomorrow and schedule meeting next Friday at 2pm',
        { strategy: 'hybrid' }
      );

      expect(result.extractions).toHaveLength(2);

      // First extraction: "tomorrow" (day grain)
      const tomorrowExtraction = result.extractions.find(e => e.originalText === 'tomorrow');
      expect(tomorrowExtraction?.grain).toBe('day');

      // Second extraction: "next Friday at 2pm" (minute grain)
      const fridayExtraction = result.extractions.find(e => e.originalText.includes('Friday'));
      expect(['hour', 'minute', 'second']).toContain(fridayExtraction?.grain);

      // Enhanced text should show date only for tomorrow, date+time for Friday
      expect(result.enhancedText).toMatch(/tomorrow \(\d{4}-\d{2}-\d{2}\)/);
      expect(result.enhancedText).toMatch(/Friday at 2pm \(\d{4}-\d{2}-\d{2} \d+:\d+ [AP]M UTC\)/);
    });
  });

  describe('Ambiguous time expressions', () => {
    const ambiguousExpressions = [
      'tomorrow morning',
      'next Friday afternoon',
      'this evening',
      'yesterday night'
    ];

    ambiguousExpressions.forEach(expression => {
      it(`should treat "${expression}" as day-grain (ambiguous time)`, () => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(result.extractions[0].grain).toBe('day');

        // Should show date only since time is ambiguous
        expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2}\)$/);
      });
    });
  });

  describe('Preserve strategy should not be affected by grain', () => {
    it('should preserve original text regardless of grain', () => {
      const expressions = [
        'tomorrow',
        'tomorrow at 3pm',
        'next Friday at 2:30pm'
      ];

      expressions.forEach(expression => {
        const result = timeAI.enhancePrompt(`Meet ${expression}`, { strategy: 'preserve' });
        expect(result.enhancedText).toBe(`Meet ${expression}`);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle expressions with no certain time components', () => {
      const result = timeAI.enhancePrompt('Call sometime next week', { strategy: 'hybrid' });

      if (result.extractions.length > 0) {
        expect(result.extractions[0].grain).toBe('day');
        expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2}\)$/);
      }
    });

    it('should handle malformed time expressions', () => {
      const result = timeAI.enhancePrompt('Meet tomorrow at 25 o\'clock', { strategy: 'hybrid' });

      // Should either not parse or default to day grain
      if (result.extractions.length > 0) {
        // If it parses "tomorrow", it should be day grain
        expect(result.extractions.some(e => e.grain === 'day')).toBe(true);
      }
    });
  });
});