import { TimeAI } from '../src';

describe('Timezone-Aware Parsing', () => {
  const testTimezones = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Australia/Melbourne'
  ];

  describe('Time-specific expressions should respect timezone', () => {
    testTimezones.forEach(timezone => {
      describe(`Timezone: ${timezone}`, () => {
        let timeAI: TimeAI;

        beforeEach(() => {
          timeAI = new TimeAI({
            timezone,
            locale: 'en-US',
            includeContext: false
          });
        });

        it('should parse "tomorrow at 3pm" as 3pm in target timezone', () => {
          const result = timeAI.enhancePrompt('Meet tomorrow at 3pm', { strategy: 'hybrid' });

          expect(result.extractions).toHaveLength(1);
          expect(result.extractions[0].grain).not.toBe('day'); // Should have time grain

          // Verify the time is actually 3pm in the target timezone
          const resolvedDate = result.extractions[0].resolvedDate;
          const timeInTargetTZ = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(resolvedDate);

          expect(timeInTargetTZ).toBe('03:00 PM');
        });

        it('should parse "next Tuesday at 9:30am" correctly', () => {
          const result = timeAI.enhancePrompt('Call next Tuesday at 9:30am', { strategy: 'hybrid' });

          expect(result.extractions).toHaveLength(1);

          const resolvedDate = result.extractions[0].resolvedDate;
          const timeInTargetTZ = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(resolvedDate);

          expect(timeInTargetTZ).toBe('09:30 AM');
        });

        it('should show correct timezone in enhanced text', () => {
          const result = timeAI.enhancePrompt('Meet tomorrow at 2pm', { strategy: 'hybrid' });

          expect(result.enhancedText).toContain(timezone);
          expect(result.enhancedText).toMatch(new RegExp(`2:00 PM ${timezone.replace('/', '\\/')}`));
        });

        it('should handle noon correctly', () => {
          const result = timeAI.enhancePrompt('Lunch tomorrow at noon', { strategy: 'hybrid' });

          expect(result.extractions).toHaveLength(1);

          const resolvedDate = result.extractions[0].resolvedDate;
          const timeInTargetTZ = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(resolvedDate);

          expect(timeInTargetTZ).toBe('12:00 PM');
        });

        it('should handle midnight correctly', () => {
          const result = timeAI.enhancePrompt('Deploy tomorrow at midnight', { strategy: 'hybrid' });

          expect(result.extractions).toHaveLength(1);

          const resolvedDate = result.extractions[0].resolvedDate;
          const timeInTargetTZ = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(resolvedDate);

          expect(timeInTargetTZ).toBe('12:00 AM');
        });
      });
    });
  });

  describe('Day-only expressions should not include arbitrary times', () => {
    testTimezones.forEach(timezone => {
      it(`should parse "tomorrow" without time in ${timezone}`, () => {
        const timeAI = new TimeAI({
          timezone,
          includeContext: false
        });

        const result = timeAI.enhancePrompt('Meet tomorrow', { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(result.extractions[0].grain).toBe('day');

        // Should not include time information
        expect(result.enhancedText).toMatch(/tomorrow \(\d{4}-\d{2}-\d{2}\)$/);
        expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
      });

      it(`should parse "next Friday" without time in ${timezone}`, () => {
        const timeAI = new TimeAI({
          timezone,
          includeContext: false
        });

        const result = timeAI.enhancePrompt('Deadline next Friday', { strategy: 'hybrid' });

        expect(result.extractions).toHaveLength(1);
        expect(result.extractions[0].grain).toBe('day');

        // Should not include time information
        expect(result.enhancedText).toMatch(/next Friday \(\d{4}-\d{2}-\d{2}\)$/);
        expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
      });
    });
  });

  describe('Cross-timezone consistency', () => {
    it('should parse same time expressions to different UTC times across timezones', () => {
      const expression = 'tomorrow at 3pm';
      const utcTimes: string[] = [];

      testTimezones.forEach(timezone => {
        const timeAI = new TimeAI({ timezone, includeContext: false });
        const result = timeAI.enhancePrompt(expression, { strategy: 'hybrid' });

        if (result.extractions.length > 0) {
          utcTimes.push(result.extractions[0].resolvedDate.toISOString());
        }
      });

      // All UTC times should be different (except for timezones with same offset)
      const uniqueUtcTimes = new Set(utcTimes);
      expect(uniqueUtcTimes.size).toBeGreaterThan(1); // Should have multiple unique times
    });

    it('should all display as same local time despite different UTC times', () => {
      const expression = 'meet tomorrow at 4:30pm';

      testTimezones.forEach(timezone => {
        const timeAI = new TimeAI({ timezone, includeContext: false });
        const result = timeAI.enhancePrompt(expression, { strategy: 'hybrid' });

        if (result.extractions.length > 0) {
          const resolvedDate = result.extractions[0].resolvedDate;
          const localTime = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }).format(resolvedDate);

          expect(localTime).toBe('04:30 PM');
        }
      });
    });
  });

  describe('Reference date handling across timezones', () => {
    it('should respect reference date in target timezone', () => {
      const referenceDate = new Date('2025-01-01T12:00:00Z'); // New Year's Day noon UTC

      testTimezones.forEach(timezone => {
        const timeAI = new TimeAI({ timezone, includeContext: false });
        const result = timeAI.enhancePrompt('tomorrow', {
          strategy: 'hybrid'
        });

        // Parse with explicit reference date
        const resultWithRef = timeAI.parseDates('tomorrow', { referenceDate });

        if (resultWithRef.length > 0) {
          const resolvedDate = resultWithRef[0].resolvedDate;

          // Should be January 2nd in the target timezone
          const dateInTZ = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone
          }).format(resolvedDate); // en-CA gives YYYY-MM-DD format

          expect(dateInTZ).toBe('2025-01-02');
        }
      });
    });
  });

  describe('Absolute date parsing with timezones', () => {
    testTimezones.forEach(timezone => {
      it(`should parse absolute dates with times correctly in ${timezone}`, () => {
        const timeAI = new TimeAI({ timezone, includeContext: false });
        const result = timeAI.enhancePrompt(
          'September 15, 2025 at 2:30 PM',
          { strategy: 'hybrid' }
        );

        expect(result.extractions).toHaveLength(1);

        const resolvedDate = result.extractions[0].resolvedDate;
        const timeInTZ = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(resolvedDate);

        expect(timeInTZ).toBe('02:30 PM');

        const dateInTZ = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(resolvedDate);

        expect(dateInTZ).toBe('09/15/2025');
      });
    });
  });

  describe('DST (Daylight Saving Time) considerations', () => {
    const dstTimezones = ['America/New_York', 'Europe/London', 'Australia/Sydney'];

    dstTimezones.forEach(timezone => {
      it(`should handle ${timezone} timezone correctly regardless of DST`, () => {
        const timeAI = new TimeAI({ timezone, includeContext: false });

        // Test during different times of year that might have different DST status
        const testDates = [
          new Date('2025-01-15T12:00:00Z'), // Winter
          new Date('2025-07-15T12:00:00Z')  // Summer
        ];

        testDates.forEach(referenceDate => {
          const result = timeAI.parseDates('tomorrow at 3pm', { referenceDate });

          if (result.length > 0) {
            const resolvedDate = result[0].resolvedDate;
            const timeInTZ = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            }).format(resolvedDate);

            expect(timeInTZ).toBe('03:00 PM');
          }
        });
      });
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle invalid timezone gracefully', () => {
      expect(() => {
        new TimeAI({ timezone: 'Invalid/Timezone' });
      }).not.toThrow(); // Should not crash, might fall back to UTC
    });

    it('should handle empty timezone string', () => {
      expect(() => {
        new TimeAI({ timezone: '' });
      }).not.toThrow();
    });

    it('should parse correctly when timezone matches system timezone', () => {
      const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const timeAI = new TimeAI({ timezone: systemTZ, includeContext: false });

      const result = timeAI.enhancePrompt('tomorrow at 5pm', { strategy: 'hybrid' });

      if (result.extractions.length > 0) {
        const resolvedDate = result.extractions[0].resolvedDate;
        const timeInTZ = new Intl.DateTimeFormat('en-US', {
          timeZone: systemTZ,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(resolvedDate);

        expect(timeInTZ).toBe('05:00 PM');
      }
    });
  });
});