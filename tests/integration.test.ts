import { TimeAI, enhancePrompt, parseDate, addContext, createTimeAI, timeAI as defaultTimeAI } from '../src';

describe('Integration Tests', () => {
  describe('Real-world prompt enhancement scenarios', () => {
    let timeAI: TimeAI;

    beforeEach(() => {
      timeAI = new TimeAI({
        timezone: 'America/New_York',
        locale: 'en-US'
      });
    });

    it('should handle complex meeting scheduling prompts', () => {
      const prompt = 'Schedule a team standup for tomorrow at 9am and send reminders to everyone by end of week';

      const result = timeAI.enhancePrompt(prompt);

      expect(result.extractions.length).toBeGreaterThanOrEqual(2);
      expect(result.enhancedText).toContain('tomorrow');
      expect(result.enhancedText).toContain('end of week');
      expect(result.context).toContain('Current date:');
      expect(result.tokensAdded).toBeGreaterThan(0);
    });

    it('should handle project deadline prompts', () => {
      const prompt = 'The MVP should be delivered by next Friday and we need to do a demo next week';

      const result = timeAI.enhancePrompt(prompt, { strategy: 'hybrid' });

      expect(result.extractions).toHaveLength(2);
      expect(result.enhancedText).toMatch(/next Friday \(\d{4}-\d{2}-\d{2}.*\)/);
      expect(result.enhancedText).toContain('next week');
    });

    it('should handle vacation planning prompts', () => {
      const prompt = 'Book vacation from next Monday to end of month and arrange coverage';

      const result = timeAI.enhancePrompt(prompt, { strategy: 'normalize' });

      expect(result.extractions.length).toBeGreaterThanOrEqual(1); // At least one date should be found
      expect(result.enhancedText).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should handle quarterly business reviews', () => {
      const prompt = 'Prepare QBR presentation by end of quarter and schedule reviews with each team lead';

      const result = timeAI.enhancePrompt(prompt);

      expect(result.extractions.length).toBeGreaterThanOrEqual(1);
      const quarterExtraction = result.extractions.find(e => e.originalText.includes('quarter'));
      if (quarterExtraction) {
        expect(quarterExtraction.type).toBe('relative');
      }
    });
  });

  describe('Multi-timezone scenarios', () => {
    it('should handle different timezones correctly', () => {
      const nyTimeAI = new TimeAI({ timezone: 'America/New_York' });
      const londonTimeAI = new TimeAI({ timezone: 'Europe/London' });
      const tokyoTimeAI = new TimeAI({ timezone: 'Asia/Tokyo' });

      const prompt = 'Schedule call for tomorrow at 10am';

      const nyResult = nyTimeAI.enhancePrompt(prompt);
      const londonResult = londonTimeAI.enhancePrompt(prompt);
      const tokyoResult = tokyoTimeAI.enhancePrompt(prompt);

      // All should parse the same text but in different timezone contexts
      expect(nyResult.extractions[0].originalText).toBe('tomorrow at 10am');
      expect(londonResult.extractions[0].originalText).toBe('tomorrow at 10am');
      expect(tokyoResult.extractions[0].originalText).toBe('tomorrow at 10am');

      // Context should reflect different timezones
      expect(nyResult.context).toContain('America/New_York');
      expect(londonResult.context).toContain('Europe/London');
      expect(tokyoResult.context).toContain('Asia/Tokyo');
    });

    it('should maintain timezone consistency within instance', () => {
      const timeAI = new TimeAI({ timezone: 'Europe/Paris' });

      const prompt1 = 'Meet tomorrow';
      const prompt2 = 'Call next week';

      const result1 = timeAI.enhancePrompt(prompt1);
      const result2 = timeAI.enhancePrompt(prompt2);

      expect(result1.context).toContain('Europe/Paris');
      expect(result2.context).toContain('Europe/Paris');
    });
  });

  describe('Strategy comparison', () => {
    let timeAI: TimeAI;

    beforeEach(() => {
      timeAI = new TimeAI({
        timezone: 'UTC',
        locale: 'en-US'
      });
    });

    it('should show clear differences between strategies', () => {
      const prompt = 'Deliver project next Friday and schedule review next week';

      const preserve = timeAI.enhancePrompt(prompt, { strategy: 'preserve' });
      const normalize = timeAI.enhancePrompt(prompt, { strategy: 'normalize' });
      const hybrid = timeAI.enhancePrompt(prompt, { strategy: 'hybrid' });

      // Preserve should keep original text
      expect(preserve.enhancedText).toContain('next Friday');
      expect(preserve.enhancedText).toContain('next week');

      // Normalize should replace with absolute dates
      expect(normalize.enhancedText).toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(normalize.enhancedText).not.toContain('next Friday');

      // Hybrid should combine both
      expect(hybrid.enhancedText).toContain('next Friday');
      expect(hybrid.enhancedText).toMatch(/\(\d{4}-\d{2}-\d{2}.*\)/);
    });
  });

  describe('Performance with long texts', () => {
    it('should handle long texts with multiple dates efficiently', () => {
      const longPrompt = `
        This is a comprehensive project timeline. We need to start planning by next Monday,
        have the first milestone completed by end of month, conduct reviews every Tuesday
        for the next 4 weeks, schedule quarterly presentations by end of Q3, and prepare
        for the final deadline which is December 31st, 2025. Additionally, we should have
        weekly check-ins every Friday morning and monthly reports due by the 15th of each month.
        The project kickoff is scheduled for tomorrow and we need to have all team members
        confirmed by next week. Don't forget about the holiday break from December 23rd to January 2nd.
      `;

      const startTime = Date.now();
      const result = defaultTimeAI.enhancePrompt(longPrompt);
      const endTime = Date.now();

      expect(result.extractions.length).toBeGreaterThan(5);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.tokensAdded).toBeGreaterThan(0);
      expect(result.enhancedText.length).toBeGreaterThanOrEqual(longPrompt.length);
    });

    it('should handle texts with no dates quickly', () => {
      const longTextNoDates = `
        This is a very long text that contains no dates whatsoever. It talks about
        various topics like technology, business processes, team management, and
        strategic planning without mentioning any specific times or dates. The text
        goes on and on with lots of information but nothing that would trigger the
        date parser to find any temporal references. We discuss methodologies,
        best practices, and theoretical frameworks extensively.
      `.repeat(10);

      const startTime = Date.now();
      const result = defaultTimeAI.enhancePrompt(longTextNoDates);
      const endTime = Date.now();

      expect(result.extractions).toHaveLength(0);
      expect(endTime - startTime).toBeLessThan(500); // Should be very fast
      expect(result.enhancedText).toBe(longTextNoDates);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty and null inputs gracefully', () => {
      const timeAI = new TimeAI();

      expect(() => timeAI.enhancePrompt('')).not.toThrow();
      expect(() => timeAI.parseDate('')).not.toThrow();
      expect(() => timeAI.addContext('')).not.toThrow();

      const emptyResult = timeAI.enhancePrompt('');
      expect(emptyResult.originalText).toBe('');
      expect(emptyResult.enhancedText).toBe('');
      expect(emptyResult.extractions).toHaveLength(0);
    });

    it('should handle invalid dates in context', () => {
      const timeAI = new TimeAI();

      // Test with ambiguous date strings
      const ambiguous = timeAI.parseDate('maybe sometime');
      expect(ambiguous).toBeNull();

      const vague = timeAI.enhancePrompt('We should meet sometime, maybe');
      expect(vague.extractions).toHaveLength(0);
    });

    it('should handle configuration changes mid-session', () => {
      const timeAI = new TimeAI({ timezone: 'UTC' });

      const result1 = timeAI.enhancePrompt('Meet tomorrow');
      expect(result1.context).toContain('UTC');

      timeAI.setTimezone('America/New_York');
      timeAI.setLocale('en-US');

      const result2 = timeAI.enhancePrompt('Call next week');
      expect(result2.context).toContain('America/New_York');
    });
  });

  describe('Convenience functions integration', () => {
    it('should work with global convenience functions', () => {
      const enhanced = enhancePrompt('Meet tomorrow at 3pm');
      expect(enhanced.extractions).toHaveLength(1);
      expect(enhanced.extractions[0].originalText).toBe('tomorrow at 3pm');

      const parsed = parseDate('next Friday');
      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe('relative');

      const withContext = addContext('What should I do?');
      expect(withContext).toContain('Current date:');
      expect(withContext).toContain('What should I do?');
    });

    it('should work with factory function', () => {
      const customAI = createTimeAI({
        timezone: 'Asia/Tokyo',
        strategy: 'normalize'
      });

      const result = customAI.enhancePrompt('Schedule for next Monday');
      expect(result.context).toContain('Asia/Tokyo');
      expect(result.enhancedText).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should allow configuration override in convenience functions', () => {
      const result1 = enhancePrompt('Meet tomorrow');
      const result2 = enhancePrompt('Meet tomorrow', { timezone: 'Europe/London' });

      expect(result1.context).not.toContain('Europe/London');
      expect(result2.context).toContain('Europe/London');
    });
  });

  describe('Legacy compatibility', () => {
    it('should support legacy function signatures', () => {
      const timeAI = new TimeAI();

      const context = timeAI.getCurrentTimeContext();
      expect(context.now).toBeInstanceOf(Date);
      expect(context.timezone).toBeDefined();

      const formatted = timeAI.formatDateForOpenAI(new Date());
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const enhanced = timeAI.addDateContextToPrompt('Hello world');
      expect(enhanced).toContain('Current date:');
      expect(enhanced).toContain('Hello world');
    });
  });

  describe('Real-time context awareness', () => {
    it('should provide current context in all operations', () => {
      const timeAI = new TimeAI();

      const before = Date.now();
      const result = timeAI.enhancePrompt('What time is it?');
      const after = Date.now();

      // Extract the date from context
      const dateMatch = result.context.match(/Current date: (\d{4}-\d{2}-\d{2})/);
      expect(dateMatch).not.toBeNull();

      const contextDate = new Date(dateMatch![1]);
      const contextTime = contextDate.getTime();

      expect(contextTime).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000);
      expect(contextTime).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000);
    });

    it('should handle concurrent requests consistently', async () => {
      const timeAI = new TimeAI();

      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(timeAI.enhancePrompt(`Task ${i} due tomorrow`))
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.extractions).toHaveLength(1);
        expect(result.originalText).toBe(`Task ${i} due tomorrow`);
        expect(result.context).toContain('Current date:');
      });

      // All contexts should be very close in time
      const timestamps = results.map(r => {
        const match = r.context.match(/Current date: (\d{4}-\d{2}-\d{2})/);
        return new Date(match![1]).getTime();
      });

      const maxTimestamp = Math.max(...timestamps);
      const minTimestamp = Math.min(...timestamps);
      expect(maxTimestamp - minTimestamp).toBeLessThan(24 * 60 * 60 * 1000); // Within a day
    });
  });

  describe('Complex date parsing scenarios', () => {
    let timeAI: TimeAI;

    beforeEach(() => {
      timeAI = new TimeAI({ timezone: 'America/New_York' });
    });

    it('should parse business-specific temporal expressions', () => {
      const businessPrompts = [
        'Submit quarterly report by EOQ',
        'Schedule review for next business day',
        'Deadline is end of this week',
        'Plan for Q4 deliverables',
        'Monthly standup every first Friday'
      ];

      businessPrompts.forEach(prompt => {
        const result = timeAI.enhancePrompt(prompt);
        if (result.extractions.length > 0) {
          expect(result.extractions[0].confidence).toBeGreaterThan(0.5);
        }
      });
    });

    it('should handle overlapping date expressions', () => {
      const prompt = 'Schedule for Friday the 13th next month';

      const result = timeAI.enhancePrompt(prompt);
      expect(result.extractions.length).toBeGreaterThan(0);

      // Should capture the full date expression
      expect(result.extractions.some(e =>
        e.originalText.includes('Friday') || e.originalText.includes('13th')
      )).toBe(true);
    });

    it('should handle ambiguous expressions contextually', () => {
      const ambiguousPrompts = [
        'Set reminder for May',          // Could be month or modal verb
        'Schedule for this morning',     // Time-dependent
        'Due yesterday',                 // Past reference
        'Plan for tomorrow morning'      // Compound time reference
      ];

      ambiguousPrompts.forEach(prompt => {
        const result = timeAI.enhancePrompt(prompt);
        // Should either parse correctly or not parse at all
        if (result.extractions.length > 0) {
          result.extractions.forEach(extraction => {
            expect(extraction.confidence).toBeGreaterThan(0);
            expect(extraction.resolvedDate).toBeInstanceOf(Date);
          });
        }
      });
    });
  });
});