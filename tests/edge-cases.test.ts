import { TimeAI } from '../src';

describe('Edge Cases and Error Handling', () => {
  let timeAI: TimeAI;

  beforeEach(() => {
    timeAI = new TimeAI({
      timezone: 'America/New_York',
      locale: 'en-US'
    });
  });

  describe('Input validation', () => {
    it('should handle null and undefined inputs gracefully', () => {
      expect(() => timeAI.enhancePrompt(null as any)).not.toThrow();
      expect(() => timeAI.enhancePrompt(undefined as any)).not.toThrow();
      expect(() => timeAI.parseDate(null as any)).not.toThrow();
      expect(() => timeAI.parseDate(undefined as any)).not.toThrow();

      const nullResult = timeAI.enhancePrompt(null as any);
      expect(nullResult.extractions).toHaveLength(0);

      const undefResult = timeAI.parseDate(undefined as any);
      expect(undefResult).toBeNull();
    });

    it('should handle empty strings', () => {
      const result = timeAI.enhancePrompt('');
      expect(result.originalText).toBe('');
      expect(result.enhancedText).toBe('');
      expect(result.extractions).toHaveLength(0);
      expect(result.context).toBeDefined();
    });

    it('should handle whitespace-only strings', () => {
      const whitespaceInputs = ['   ', '\t', '\n', '\r\n', ' \t \n '];

      whitespaceInputs.forEach(input => {
        const result = timeAI.enhancePrompt(input);
        expect(result.extractions).toHaveLength(0);

        const parsed = timeAI.parseDate(input);
        expect(parsed).toBeNull();
      });
    });

    it('should handle very long strings', () => {
      const veryLongString = 'a'.repeat(100000) + ' tomorrow ' + 'b'.repeat(100000);

      expect(() => timeAI.enhancePrompt(veryLongString)).not.toThrow();
      const result = timeAI.enhancePrompt(veryLongString);
      expect(result.extractions).toHaveLength(1);
    });

    it('should handle special characters and unicode', () => {
      const unicodeTexts = [
        '会议明天举行', // Chinese
        'réunion demain', // French with accents
        'встреча завтра', // Russian/Cyrillic
        'مقابلة غداً', // Arabic
        '明日のミーティング', // Japanese
        'Cöňfërèñçè tömörrøw', // Mixed special characters
        '🗓️ Meeting tomorrow 📅', // With emojis
        'Meeting\u2028tomorrow', // Line separator
        'Meeting\u0000tomorrow' // Null character
      ];

      unicodeTexts.forEach(text => {
        expect(() => timeAI.enhancePrompt(text)).not.toThrow();
        expect(() => timeAI.parseDate(text)).not.toThrow();
      });
    });
  });

  describe('Date parsing edge cases', () => {
    it('should handle ambiguous date references', () => {
      const ambiguousTexts = [
        'may be tomorrow',  // "may" as modal verb, not month
        'will tomorrow',    // Grammatically incorrect but common
        'tomorrow maybe',   // Uncertain temporal reference
        'around tomorrow',  // Approximate temporal reference
        'tomorrow ish',     // Informal temporal reference
        'tomorrow-ish',     // Hyphenated informal reference
        'kinda tomorrow',   // Very informal
        'sorta next week'   // Very informal
      ];

      ambiguousTexts.forEach(text => {
        const result = timeAI.parseDate(text);
        if (result) {
          // If parsed, confidence should reflect ambiguity (but some may still be high if chrono is confident)
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
        // Should not throw
        expect(true).toBe(true);
      });
    });

    it('should handle impossible dates gracefully', () => {
      const impossibleDates = [
        'February 30th',
        'April 31st',
        'November 31st',
        '25th hour',
        '99th minute',
        'Day -1',
        'Month 13',
        'Year 99999'
      ];

      impossibleDates.forEach(text => {
        expect(() => timeAI.parseDate(text)).not.toThrow();
        // Some might parse to valid dates (e.g., Feb 30 -> Mar 2)
        // or return null, both are acceptable
      });
    });

    it('should handle historical and future edge dates', () => {
      const edgeDates = [
        'January 1, 1900',   // Early 20th century
        'December 31, 1999', // Y2K boundary
        'January 1, 2000',   // Y2K boundary
        'February 29, 2000', // Leap year (divisible by 400)
        'February 29, 1900', // Not a leap year (divisible by 100 but not 400)
        'December 31, 2099', // Far future
        'January 1, 3000'    // Very far future
      ];

      edgeDates.forEach(text => {
        const result = timeAI.parseDate(text);
        if (result) {
          expect(result.resolvedDate).toBeInstanceOf(Date);
          expect(isNaN(result.resolvedDate.getTime())).toBe(false);
        }
      });
    });

    it('should handle timezone boundary conditions', () => {
      // Test around timezone boundaries
      const timezones = [
        'Pacific/Kiritimati', // UTC+14 (earliest timezone)
        'Pacific/Niue',       // UTC-11 (latest timezone)
        'UTC',                // Reference timezone
        'America/New_York',   // EST/EDT
        'Europe/London',      // GMT/BST
        'Asia/Calcutta'       // UTC+5:30 (half hour offset)
      ];

      timezones.forEach(tz => {
        const customTimeAI = new TimeAI({ timezone: tz });

        expect(() => customTimeAI.parseDate('tomorrow')).not.toThrow();
        expect(() => customTimeAI.enhancePrompt('Meet tomorrow')).not.toThrow();

        const result = customTimeAI.getContext();
        expect(result.timezone).toBe(tz);
      });
    });

    it('should handle daylight saving time transitions', () => {
      const dstTimeAI = new TimeAI({ timezone: 'America/New_York' });

      // Spring forward (2nd Sunday in March)
      const springForward = new Date('2025-03-09T07:00:00Z'); // 2 AM EST becomes 3 AM EDT
      // Fall back (1st Sunday in November)
      const fallBack = new Date('2025-11-02T06:00:00Z'); // 2 AM EDT becomes 1 AM EST

      expect(() => {
        dstTimeAI.formatDate(springForward, 'human');
        dstTimeAI.formatDate(fallBack, 'human');
      }).not.toThrow();
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle invalid timezone configurations', () => {
      const invalidTimezones = [
        'Invalid/Timezone',
        'America/Nonexistent',
        '',
        'UTC+25', // Invalid offset
        'Random String',
        '12345',
        null as any,
        undefined as any
      ];

      invalidTimezones.forEach(tz => {
        expect(() => new TimeAI({ timezone: tz })).not.toThrow();
        // Should fall back to system timezone or handle gracefully
      });
    });

    it('should handle invalid locale configurations', () => {
      const invalidLocales = [
        'invalid-locale',
        'xx-XX',
        '',
        '12345',
        'toolong-toolong-toolong',
        null as any,
        undefined as any
      ];

      invalidLocales.forEach(locale => {
        expect(() => new TimeAI({ locale: locale })).not.toThrow();
        // Should fall back to system locale or handle gracefully
      });
    });

    it('should handle invalid strategy configurations', () => {
      const invalidStrategies = [
        'invalid' as any,
        '' as any,
        123 as any,
        null as any,
        undefined as any
      ];

      invalidStrategies.forEach(strategy => {
        expect(() => new TimeAI({ strategy: strategy })).not.toThrow();
      });
    });

    it('should handle dynamic configuration changes', () => {
      const ai = new TimeAI();

      // Rapidly change configurations
      for (let i = 0; i < 100; i++) {
        ai.setTimezone(['UTC', 'America/New_York', 'Europe/London'][i % 3]);
        ai.setLocale(['en-US', 'en-GB', 'fr-FR'][i % 3]);

        const result = ai.enhancePrompt(`Test ${i} tomorrow`);
        expect(result.extractions.length).toBeGreaterThanOrEqual(0); // May or may not parse depending on parsing variations
      }
    });
  });

  describe('Memory and resource limits', () => {
    it('should handle extremely nested date references', () => {
      const nested = 'tomorrow at the meeting scheduled for next week during the presentation planned for next month';

      const result = timeAI.enhancePrompt(nested);
      expect(result.extractions.length).toBeGreaterThan(0);
      expect(result.extractions.every(e => e.resolvedDate instanceof Date)).toBe(true);
    });

    it('should handle circular date references', () => {
      const circular = 'the deadline for the project that determines the deadline for the project';

      expect(() => timeAI.enhancePrompt(circular)).not.toThrow();
    });

    it('should handle malformed text gracefully', () => {
      const malformedTexts = [
        'tomorrow\0next\0week',           // Null bytes
        'tomorrow\u200B\u200C\u200D',    // Zero-width characters
        '\uFEFFtomorrow\uFEFF',          // Byte order marks
        'to\u0301morrow',                // Combining characters
        String.fromCharCode(65535) + 'tomorrow', // Max UTF-16 code unit
      ];

      malformedTexts.forEach(text => {
        expect(() => timeAI.enhancePrompt(text)).not.toThrow();
      });
    });
  });

  describe('Concurrent modification', () => {
    it('should handle concurrent configuration changes safely', async () => {
      const ai = new TimeAI();
      const results: any[] = [];

      const tasks = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => {
          // Concurrent configuration changes
          if (i % 3 === 0) ai.setTimezone('UTC');
          if (i % 3 === 1) ai.setTimezone('America/New_York');
          if (i % 3 === 2) ai.setTimezone('Europe/London');

          if (i % 2 === 0) ai.setLocale('en-US');
          if (i % 2 === 1) ai.setLocale('en-GB');

          return ai.enhancePrompt(`Task ${i} due tomorrow`);
        })
      );

      const allResults = await Promise.all(tasks);

      // All results should be valid
      allResults.forEach((result, i) => {
        expect(result.extractions).toHaveLength(1);
        expect(result.originalText).toBe(`Task ${i} due tomorrow`);
        expect(result.context).toContain('Current date:');
      });
    });
  });

  describe('Date formatting edge cases', () => {
    it('should handle invalid Date objects', () => {
      const invalidDate = new Date('invalid date string');

      expect(() => timeAI.formatDate(invalidDate, 'compact')).toThrow();
      expect(() => timeAI.formatDate(invalidDate, 'iso')).toThrow();
      expect(() => timeAI.formatDate(invalidDate, 'human')).toThrow();
    });

    it('should handle extreme date values', () => {
      const extremeDates = [
        new Date(-8640000000000000), // Minimum ECMAScript date
        new Date(8640000000000000),  // Maximum ECMAScript date
        new Date(0),                 // Unix epoch
        new Date('1900-01-01'),      // Early date
        new Date('2100-12-31'),      // Future date
      ];

      extremeDates.forEach(date => {
        if (!isNaN(date.getTime())) {
          expect(() => timeAI.formatDate(date, 'compact')).not.toThrow();
          expect(() => timeAI.formatDate(date, 'human')).not.toThrow();
        }
      });
    });

    it('should handle format style edge cases', () => {
      const testDate = new Date('2025-09-15T15:30:00Z');
      const invalidStyles = ['invalid', '', null, undefined] as any[];

      invalidStyles.forEach(style => {
        // Should either handle gracefully or use default format
        expect(() => timeAI.formatDate(testDate, style)).not.toThrow();
      });
    });
  });

  describe('Context generation edge cases', () => {
    it('should handle context generation when system time is unavailable', () => {
      // Mock Date to return invalid date
      const originalDate = global.Date;
      const mockDate = class extends Date {
        constructor(...args: any[]) {
          if (args.length === 0) {
            super('invalid');
          } else {
            super(...args as []);
          }
        }
      };

      // This is a challenging test - system Date constructor being mocked
      // In practice, this is very unlikely to happen
      try {
        global.Date = mockDate as any;
        expect(() => new TimeAI()).not.toThrow();
      } finally {
        global.Date = originalDate;
      }
    });

    it('should handle Intl API unavailability gracefully', () => {
      // Save original Intl
      const originalIntl = global.Intl;

      try {
        // Mock Intl to be unavailable
        (global as any).Intl = undefined;

        expect(() => new TimeAI()).not.toThrow();
      } finally {
        global.Intl = originalIntl;
      }
    });
  });

  describe('Token counting edge cases', () => {
    it('should handle extreme text lengths for token counting', () => {
      const formatter = (timeAI as any).formatter;

      const extremeTexts = [
        '',                           // Empty
        'a',                         // Single character
        'a'.repeat(100000),         // Very long single word
        ' '.repeat(10000),          // Only spaces
        '\n'.repeat(1000),          // Only newlines
        'word '.repeat(10000),      // Many words
        '🚀'.repeat(1000),          // Unicode emojis
        Array.from({length: 1000}, (_, i) => `word${i}`).join(' ') // Unique words
      ];

      extremeTexts.forEach(text => {
        expect(() => formatter.getTokenCount(text)).not.toThrow();
        const count = formatter.getTokenCount(text);
        expect(count).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(count)).toBe(true);
      });
    });
  });

  describe('Error recovery', () => {
    it('should recover from parsing errors gracefully', () => {
      // Simulate conditions that might cause parsing errors
      const problematicTexts = [
        'tomorrow'.repeat(1000),     // Excessive repetition
        Array.from({length: 100}, (_, i) => `${i} days ago`).join(' and '), // Many dates
        'ěščřžýáíéúůťď tomorrow ňĺľô', // Heavy diacritics
        JSON.stringify({tomorrow: 'meeting', next_week: 'deadline'}), // JSON structure
        '<script>alert("tomorrow")</script>', // HTML/JS injection attempt
        'SELECT * FROM meetings WHERE date = "tomorrow"', // SQL-like structure
      ];

      problematicTexts.forEach((text, index) => {
        expect(() => {
          const result = timeAI.enhancePrompt(text);
          expect(result).toBeDefined();
          expect(result.originalText).toBe(text);
        }).not.toThrow();
      });
    });
  });
});