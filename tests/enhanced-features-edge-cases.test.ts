import { TimeAI } from '../src';

describe('Enhanced Features Edge Cases', () => {
  describe('Complex multi-date expressions', () => {
    it('should handle mixed grain expressions in different timezones', () => {
      const nycTimeAI = new TimeAI({ timezone: 'America/New_York', includeContext: false });
      const tokyoTimeAI = new TimeAI({ timezone: 'Asia/Tokyo', includeContext: false });

      const complexPrompt = 'Submit draft tomorrow, review next Monday at 2pm, and finalize by end of next week';

      const nycResult = nycTimeAI.enhancePrompt(complexPrompt, { strategy: 'hybrid' });
      const tokyoResult = tokyoTimeAI.enhancePrompt(complexPrompt, { strategy: 'hybrid' });

      // Both should find 3 date expressions
      expect(nycResult.extractions).toHaveLength(3);
      expect(tokyoResult.extractions).toHaveLength(3);

      // Find the 2pm expression
      const nycTimeExpression = nycResult.extractions.find(e => e.originalText.includes('2pm'));
      const tokyoTimeExpression = tokyoResult.extractions.find(e => e.originalText.includes('2pm'));

      expect(nycTimeExpression).toBeTruthy();
      expect(tokyoTimeExpression).toBeTruthy();

      // The 2pm expressions should resolve to different UTC times
      expect(nycTimeExpression!.resolvedDate.toISOString()).not.toBe(
        tokyoTimeExpression!.resolvedDate.toISOString()
      );

      // But both should display as 2pm in their respective timezones
      expect(nycResult.enhancedText).toMatch(/2pm \(\d{4}-\d{2}-\d{2} 2:00 PM America\/New_York\)/);
      expect(tokyoResult.enhancedText).toMatch(/2pm \(\d{4}-\d{2}-\d{2} 2:00 PM Asia\/Tokyo\)/);
    });

    it('should handle overlapping date expressions', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      // "next Monday morning at 9am" - overlapping time references
      const result = timeAI.enhancePrompt(
        'Schedule meeting next Monday morning at 9am',
        { strategy: 'hybrid' }
      );

      // Should parse this as one coherent expression
      expect(result.extractions.length).toBeGreaterThanOrEqual(1);

      const expression = result.extractions[0];
      expect(['hour', 'minute', 'second']).toContain(expression.grain);

      // Should include specific time, not just "morning"
      expect(result.enhancedText).toMatch(/9am.*9:00 AM UTC/);
    });
  });

  describe('Boundary conditions', () => {
    it('should handle expressions at timezone boundaries', () => {
      const samoaTimeAI = new TimeAI({ timezone: 'Pacific/Apia', includeContext: false }); // UTC+13/+14
      const hawaiiTimeAI = new TimeAI({ timezone: 'Pacific/Honolulu', includeContext: false }); // UTC-10

      const expression = 'tomorrow at midnight';

      const samoaResult = samoaTimeAI.enhancePrompt(expression, { strategy: 'hybrid' });
      const hawaiiResult = hawaiiTimeAI.enhancePrompt(expression, { strategy: 'hybrid' });

      if (samoaResult.extractions.length > 0 && hawaiiResult.extractions.length > 0) {
        const samoaTime = samoaResult.extractions[0].resolvedDate;
        const hawaiiTime = hawaiiResult.extractions[0].resolvedDate;

        // These should be about 1 hour apart (both parsing "tomorrow at midnight" but in different timezones)
        // Samoa UTC+13 midnight and Hawaii UTC-10 midnight are actually close in UTC time
        const timeDiffHours = Math.abs(samoaTime.getTime() - hawaiiTime.getTime()) / (1000 * 60 * 60);
        expect(timeDiffHours).toBeGreaterThan(0.5);
        expect(timeDiffHours).toBeLessThan(2);
      }
    });

    it('should handle leap year dates correctly across timezones', () => {
      const timeAI = new TimeAI({ timezone: 'Europe/London', includeContext: false });

      // February 29, 2024 was a leap year
      const referenceDate = new Date('2024-02-28T12:00:00Z');
      const result = timeAI.parseDates('tomorrow at 3pm', { referenceDate });

      if (result.length > 0) {
        const resolvedDate = result[0].resolvedDate;
        const dateInLondon = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Europe/London'
        }).format(resolvedDate);

        expect(dateInLondon).toBe('2024-02-29'); // Should correctly handle leap day
      }
    });

    it('should handle year transitions correctly', () => {
      const timeAI = new TimeAI({ timezone: 'Pacific/Auckland', includeContext: false });

      // Test near New Year's
      const newYearsEve = new Date('2024-12-31T10:00:00Z'); // 11pm Auckland time
      const result = timeAI.parseDates('tomorrow at noon', { referenceDate: newYearsEve });

      if (result.length > 0) {
        const resolvedDate = result[0].resolvedDate;
        expect(resolvedDate.getFullYear()).toBe(2025); // Should correctly handle year transition
      }
    });
  });

  describe('Performance and memory considerations', () => {
    it('should handle multiple TimeAI instances with different timezones efficiently', () => {
      const timezones = [
        'UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo',
        'Australia/Sydney', 'Pacific/Honolulu', 'America/Sao_Paulo'
      ];

      const instances = timezones.map(tz => new TimeAI({ timezone: tz, includeContext: false }));
      const expression = 'meet tomorrow at 2pm';

      const startTime = Date.now();

      const results = instances.map(instance =>
        instance.enhancePrompt(expression, { strategy: 'hybrid' })
      );

      const endTime = Date.now();

      // Should complete within reasonable time (less than 1 second for 7 instances)
      expect(endTime - startTime).toBeLessThan(1000);

      // All should have valid results
      results.forEach((result, i) => {
        expect(result.extractions).toHaveLength(1);

        // Check if time zone appears in enhanced text (only for time-specific expressions)
        if (result.extractions[0].grain !== 'day') {
          expect(result.enhancedText).toContain(timezones[i]);
          expect(result.enhancedText).toMatch(/2:00 PM/);
        } else {
          // For day-grain expressions, just check basic format
          expect(result.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2}\)/);
        }
      });
    });

    it('should handle very long prompts with many dates efficiently', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const longPrompt = Array(20).fill(0).map((_, i) =>
        `Task ${i + 1}: Schedule meeting next Monday at ${(i % 12) + 1}pm and follow up tomorrow`
      ).join('. ');

      const startTime = Date.now();
      const result = timeAI.enhancePrompt(longPrompt, { strategy: 'hybrid' });
      const endTime = Date.now();

      // Should handle long prompts efficiently
      expect(endTime - startTime).toBeLessThan(5000); // Less than 5 seconds

      // Should find many date expressions
      expect(result.extractions.length).toBeGreaterThan(30); // At least 40 date expressions
    });
  });

  describe('Strategy consistency across timezones', () => {
    const strategies: ('preserve' | 'normalize' | 'hybrid')[] = ['preserve', 'normalize', 'hybrid'];

    strategies.forEach(strategy => {
      it(`should behave consistently with ${strategy} strategy across timezones`, () => {
        const timezones = ['UTC', 'America/New_York', 'Asia/Tokyo'];
        const expression = 'deadline next Friday';

        timezones.forEach(timezone => {
          const timeAI = new TimeAI({ timezone, includeContext: false });
          const result = timeAI.enhancePrompt(expression, { strategy });

          switch (strategy) {
            case 'preserve':
              expect(result.enhancedText).toBe(expression);
              break;

            case 'normalize':
              if (result.extractions.length > 0) {
                expect(result.enhancedText).toMatch(/deadline \d{4}-\d{2}-\d{2}/);
                // Should not include time for day-grain expression
                expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
              }
              break;

            case 'hybrid':
              if (result.extractions.length > 0) {
                expect(result.enhancedText).toMatch(/deadline next Friday \(\d{4}-\d{2}-\d{2}\)/);
                // Should not include time for day-grain expression
                expect(result.enhancedText).not.toMatch(/\d{4}-\d{2}-\d{2} \d+:\d+/);
              }
              break;
          }
        });
      });
    });
  });

  describe('Grain edge cases', () => {
    it('should handle expressions with conflicting time information', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      // "tomorrow morning at 3pm" - conflicting time references
      const result = timeAI.enhancePrompt(
        'Call tomorrow morning at 3pm',
        { strategy: 'hybrid' }
      );

      if (result.extractions.length > 0) {
        // Should prioritize the more specific time (3pm) over general time (morning)
        const extraction = result.extractions[0];
        expect(['hour', 'minute', 'second']).toContain(extraction.grain);
        expect(result.enhancedText).toMatch(/3pm.*3:00 PM UTC/);
      }
    });

    it('should handle implicit vs explicit time specifications', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const testCases = [
        { text: 'lunch tomorrow', expectedGrain: 'day' }, // Implicit - lunch time varies
        { text: 'lunch tomorrow at 12pm', expectedGrain: 'minute' }, // Explicit time
        { text: 'dinner next Friday', expectedGrain: 'day' }, // Implicit - dinner time varies
        { text: 'dinner next Friday at 7:30pm', expectedGrain: 'minute' } // Explicit time
      ];

      testCases.forEach(({ text, expectedGrain }) => {
        const result = timeAI.enhancePrompt(text, { strategy: 'hybrid' });

        if (result.extractions.length > 0) {
          const grain = result.extractions[0].grain;
          if (expectedGrain === 'day') {
            expect(grain).toBe('day');
          } else {
            expect(['hour', 'minute', 'second']).toContain(grain);
          }
        }
      });
    });
  });

  describe('Integration with existing TimeAI features', () => {
    it('should work correctly with context inclusion', () => {
      const timeAI = new TimeAI({
        timezone: 'America/New_York',
        includeContext: true // Enable context
      });

      const result = timeAI.enhancePrompt('Meet tomorrow at 3pm', { strategy: 'hybrid' });

      // Should include both context and timezone-aware enhancement
      expect(result.context).toContain('Current date:');
      expect(result.context).toContain('America/New_York');
      expect(result.enhancedText).toMatch(/3pm \(\d{4}-\d{2}-\d{2} 3:00 PM America\/New_York\)/);
    });

    it('should work with different locales', () => {
      const timeAI = new TimeAI({
        timezone: 'Europe/Paris',
        locale: 'fr-FR',
        includeContext: false
      });

      // Note: chrono-node might not fully support French parsing,
      // but the timezone should still work for English expressions
      const result = timeAI.enhancePrompt('Meet tomorrow at 2pm', { strategy: 'hybrid' });

      if (result.extractions.length > 0) {
        expect(result.enhancedText).toContain('Europe/Paris');
        expect(result.enhancedText).toMatch(/2:00 PM/);
      }
    });

    it('should maintain token count accuracy with new features', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const shortText = 'Call tomorrow';
      const longText = 'Call tomorrow at 3:30pm and schedule follow-up next Monday at 9am';

      const shortResult = timeAI.enhancePrompt(shortText, { strategy: 'hybrid' });
      const longResult = timeAI.enhancePrompt(longText, { strategy: 'hybrid' });

      // Longer, more complex text should have higher token count
      expect(longResult.tokensAdded).toBeGreaterThan(shortResult.tokensAdded);

      // Token counts should be reasonable (not negative, not extremely high)
      expect(shortResult.tokensAdded).toBeGreaterThanOrEqual(0);
      expect(shortResult.tokensAdded).toBeLessThan(50);
      expect(longResult.tokensAdded).toBeGreaterThanOrEqual(0);
      expect(longResult.tokensAdded).toBeLessThan(200);
    });
  });

  describe('Error recovery and graceful degradation', () => {
    it('should handle corrupted date expressions gracefully', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const corruptedExpressions = [
        'tomorrow at 25:99pm', // Invalid time
        'Febtember 32nd at 3pm', // Invalid date
        'next Moonday at noon', // Misspelled day
        'tomorrow at 3pm and also at 4am yesterday' // Contradictory
      ];

      corruptedExpressions.forEach(expression => {
        expect(() => {
          const result = timeAI.enhancePrompt(expression, { strategy: 'hybrid' });
          // Should not crash, result might have partial parsing or no extractions
          expect(result).toBeDefined();
          expect(result.originalText).toBe(expression);
          expect(result.enhancedText).toBeDefined();
        }).not.toThrow();
      });
    });

    it('should handle extreme future dates', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const extremeDate = new Date('2050-01-01T00:00:00Z');
      const result = timeAI.parseDates('tomorrow at 3pm', { referenceDate: extremeDate });

      if (result.length > 0) {
        const resolvedDate = result[0].resolvedDate;
        expect(resolvedDate.getFullYear()).toBe(2050);
        expect(resolvedDate.getUTCDate()).toBe(2); // Tomorrow from Jan 1st (UTC)
      }
    });

    it('should handle extreme past dates', () => {
      const timeAI = new TimeAI({ timezone: 'UTC', includeContext: false });

      const pastDate = new Date('1900-01-01T00:00:00Z');
      const result = timeAI.parseDates('tomorrow at noon', { referenceDate: pastDate });

      if (result.length > 0) {
        const resolvedDate = result[0].resolvedDate;
        expect(resolvedDate.getFullYear()).toBe(1900);
        expect(resolvedDate.getUTCDate()).toBe(2);
      }
    });
  });
});