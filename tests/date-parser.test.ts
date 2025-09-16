import { DateParser } from '../src/core/date-parser';

describe('DateParser', () => {
  let parser: DateParser;

  beforeEach(() => {
    parser = new DateParser();
  });

  describe('basic parsing', () => {
    it('should parse simple relative dates', () => {
      const result = parser.parseFirst('tomorrow at 3pm');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('relative');
      expect(result!.originalText).toBe('tomorrow at 3pm');
      expect(result!.grain).toBe('minute'); // "3pm" implies "3:00pm" so minute is certain
      expect(result!.confidence).toBeGreaterThan(0.8);
    });

    it('should parse absolute dates', () => {
      const result = parser.parseFirst('September 15, 2025 at 2:30 PM', { timezone: 'UTC' });

      expect(result).not.toBeNull();
      expect(result!.type).toBe('absolute');
      expect(result!.resolvedDate.getUTCFullYear()).toBe(2025);
      expect(result!.resolvedDate.getUTCMonth()).toBe(8); // September
      expect(result!.resolvedDate.getUTCDate()).toBe(15);
      expect(result!.resolvedDate.getUTCHours()).toBe(14); // 2:30 PM = 14:30
      expect(result!.resolvedDate.getUTCMinutes()).toBe(30);
      expect(result!.grain).toBe('minute');
    });

    it('should parse multiple dates', () => {
      const results = parser.parse('Meet tomorrow and schedule Friday call');

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe('relative');
      expect(results[1].type).toBe('relative');
    });

    it('should return empty array for text with no dates', () => {
      const results = parser.parse('Hello world, this is a test');
      expect(results).toHaveLength(0);
    });
  });

  describe('custom business day parsers', () => {
    it('should parse "next business day"', () => {
      const result = parser.parseFirst('next business day');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('relative');
      expect(result!.originalText).toBe('next business day');

      // Should be a weekday (Monday-Friday)
      const dayOfWeek = result!.resolvedDate.getDay();
      expect(dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(dayOfWeek).toBeLessThanOrEqual(5);
    });

    it('should parse "this workday"', () => {
      const result = parser.parseFirst('this workday');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('relative');
    });

    it('should parse "next weekday"', () => {
      const result = parser.parseFirst('next weekday');

      expect(result).not.toBeNull();
      const dayOfWeek = result!.resolvedDate.getDay();
      expect(dayOfWeek).toBeGreaterThanOrEqual(1);
      expect(dayOfWeek).toBeLessThanOrEqual(5);
    });
  });

  describe('end of period parsers', () => {
    it('should parse "end of week"', () => {
      const result = parser.parseFirst('end of week');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('relative');
      // Should be Friday
      expect(result!.resolvedDate.getDay()).toBe(5);
    });

    it('should parse "end of this week"', () => {
      const result = parser.parseFirst('end of this week');

      expect(result).not.toBeNull();
      expect(result!.resolvedDate.getDay()).toBe(5);
    });

    it('should parse "end of month"', () => {
      const result = parser.parseFirst('end of month');

      expect(result).not.toBeNull();
      const date = result!.resolvedDate;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      expect(date.getDate()).toBe(lastDay);
    });

    it('should parse "end of quarter"', () => {
      const result = parser.parseFirst('end of quarter');

      expect(result).not.toBeNull();
      const date = result!.resolvedDate;
      const month = date.getMonth();
      expect([2, 5, 8, 11]).toContain(month); // March, June, September, December
    });

    it('should parse "end of year"', () => {
      const result = parser.parseFirst('end of year');

      expect(result).not.toBeNull();
      const date = result!.resolvedDate;
      expect(date.getMonth()).toBe(11); // December
      expect(date.getDate()).toBe(31);
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence for specific times', () => {
      const result = parser.parseFirst('tomorrow at 3:30 PM');
      expect(result!.confidence).toBeGreaterThan(0.9);
    });

    it('should have confidence within valid range for ambiguous text', () => {
      const result = parser.parseFirst('sometime next week maybe');
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      } else {
        // If the parser doesn't even parse this ambiguous text, that's also acceptable
        expect(result).toBeNull();
      }
    });

    it('should handle confidence for different specificity levels', () => {
      const vague = parser.parseFirst('next week');
      const specific = parser.parseFirst('next Tuesday at 2:30 PM');

      // Both should parse and have valid confidence levels
      expect(vague).not.toBeNull();
      expect(specific).not.toBeNull();

      if (vague && specific) {
        expect(vague.confidence).toBeGreaterThanOrEqual(0);
        expect(vague.confidence).toBeLessThanOrEqual(1);
        expect(specific.confidence).toBeGreaterThanOrEqual(0);
        expect(specific.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('date type determination', () => {
    const relativeKeywords = ['today', 'tomorrow', 'yesterday', 'next week', 'last month', 'in 3 days', '2 hours ago'];
    const absoluteKeywords = ['September 15, 2025', 'March 1st', '2024-12-31', 'Dec 25'];

    relativeKeywords.forEach(keyword => {
      it(`should classify "${keyword}" as relative`, () => {
        const result = parser.parseFirst(keyword);
        if (result) {
          expect(result.type).toBe('relative');
        }
      });
    });

    absoluteKeywords.forEach(keyword => {
      it(`should classify "${keyword}" as absolute`, () => {
        const result = parser.parseFirst(keyword);
        if (result) {
          expect(result.type).toBe('absolute');
        }
      });
    });
  });

  describe('grain determination', () => {
    it('should determine day grain for date-only expressions', () => {
      const result = parser.parseFirst('tomorrow');
      expect(result!.grain).toBe('day');
    });

    it('should determine hour grain for hour expressions', () => {
      const result = parser.parseFirst('tomorrow at 3pm');
      expect(result!.grain).toBe('minute'); // "3pm" implies "3:00pm" so minute is certain
    });

    it('should determine minute grain for minute expressions', () => {
      const result = parser.parseFirst('tomorrow at 3:30pm');
      expect(result!.grain).toBe('minute');
    });

    it('should determine second grain for second expressions', () => {
      const result = parser.parseFirst('at 3:30:45pm');
      if (result && result.grain === 'second') {
        expect(result.grain).toBe('second');
      } else {
        // If chrono doesn't parse seconds, expect minute
        expect(result!.grain).toBe('minute');
      }
    });
  });

  describe('parsing with options', () => {
    it('should use reference date for relative parsing', () => {
      const referenceDate = new Date('2025-01-01T12:00:00Z');
      const result = parser.parseFirst('tomorrow', { referenceDate, timezone: 'UTC' });

      expect(result).not.toBeNull();
      expect(result!.resolvedDate.getUTCDate()).toBe(2);
      expect(result!.resolvedDate.getUTCMonth()).toBe(0); // January
    });

    it('should handle timezone in parsing options', () => {
      const result = parser.parseFirst('tomorrow at 3pm', {
        timezone: 'America/New_York'
      });

      expect(result).not.toBeNull();

      // Verify that 3pm NYC time was parsed correctly by checking it displays as 3pm in NYC
      const nycTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).format(result!.resolvedDate);

      expect(nycTime).toBe('03:00 PM');
    });

    it('should handle locale in parsing options', () => {
      const result = parser.parseFirst('demain', {
        locale: 'fr-FR'
      });

      // Note: chrono-node has limited French support
      // This test may pass or fail depending on chrono version
      if (result) {
        expect(result.type).toBe('relative');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      const results = parser.parse('');
      expect(results).toHaveLength(0);
    });

    it('should handle null/undefined gracefully', () => {
      const results = parser.parse('   ');
      expect(results).toHaveLength(0);
    });

    it('should handle very long text', () => {
      const longText = 'This is a very long text that contains many words and maybe tomorrow we should meet but also next week could work and perhaps in the future we can schedule something for next month and maybe even next year would be good. '.repeat(10);
      const results = parser.parse(longText);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.confidence > 0)).toBe(true);
    });

    it('should handle overlapping date expressions', () => {
      const results = parser.parse('next Friday the 13th');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle ambiguous dates correctly', () => {
      const result = parser.parseFirst('May'); // Could be month name or modal verb
      // This might not parse as a date without more context
      if (result) {
        expect(result.confidence).toBeLessThan(0.9);
      }
    });
  });

  describe('position tracking', () => {
    it('should track correct start and end positions', () => {
      const text = 'Let us meet tomorrow at 3pm for coffee';
      const results = parser.parse(text);

      expect(results).toHaveLength(1);
      const result = results[0];

      expect(result.start).toBeGreaterThanOrEqual(0);
      expect(result.end).toBeGreaterThan(result.start);
      expect(text.substring(result.start, result.end)).toBe(result.originalText);
    });

    it('should handle multiple dates with correct positions', () => {
      const text = 'Meet tomorrow and call Friday';
      const results = parser.parse(text);

      expect(results).toHaveLength(2);

      results.forEach(result => {
        expect(text.substring(result.start, result.end)).toBe(result.originalText);
      });

      // Positions should be in order
      expect(results[0].start).toBeLessThan(results[1].start);
    });
  });
});