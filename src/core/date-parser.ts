import * as chrono from 'chrono-node';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { DateExtraction, ParsingOptions, TimeContext } from '../types';

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

export class DateParser {
  private chronoInstance: chrono.Chrono;

  constructor() {
    // Create a custom chrono instance for better LLM-specific parsing
    this.chronoInstance = chrono.casual.clone();
    this.setupCustomParsers();
  }

  parse(text: string, options: ParsingOptions = {}): DateExtraction[] {
    const referenceDate = options.referenceDate || new Date();

    // Parse with chrono
    const results = this.chronoInstance.parse(text, referenceDate);

    return results.map(result => this.convertChronoResult(result, text, options));
  }

  parseFirst(text: string, options: ParsingOptions = {}): DateExtraction | null {
    const results = this.parse(text, options);
    return results.length > 0 ? results[0] : null;
  }

  extractDates(text: string, options: ParsingOptions = {}): DateExtraction[] {
    return this.parse(text, options);
  }

  private convertChronoResult(result: chrono.ParsedResult, originalText: string, options: ParsingOptions = {}): DateExtraction {
    const confidence = this.calculateConfidence(result);
    const type = this.determineType(result);
    const grain = this.determineGrain(result);

    // Use timezone-aware date construction if timezone is provided
    const startDate = this.constructTimezoneAwareDate(result, options.timezone || 'UTC', options.referenceDate);

    return {
      originalText: result.text,
      resolvedDate: startDate,
      confidence,
      type,
      start: result.index,
      end: result.index + result.text.length,
      grain
    };
  }

  private constructTimezoneAwareDate(result: chrono.ParsedResult, targetTimezone: string, referenceDate?: Date): Date {
    const components = result.start;
    const originalText = result.text.toLowerCase();

    // Start with the reference date in the target timezone
    const referenceDayjs = referenceDate
      ? dayjs(referenceDate).tz(targetTimezone)
      : dayjs().tz(targetTimezone);

    let baseDayjs: dayjs.Dayjs;

    // Handle relative dates specially
    if (originalText.includes('tomorrow')) {
      baseDayjs = referenceDayjs.add(1, 'day');
    } else if (originalText.includes('yesterday')) {
      baseDayjs = referenceDayjs.subtract(1, 'day');
    } else if (originalText.includes('today')) {
      baseDayjs = referenceDayjs;
    } else {
      // For absolute dates, start from a clean date in the target timezone
      baseDayjs = dayjs().tz(targetTimezone).startOf('day');

      // Apply chrono's date components
      if (components.get('year')) baseDayjs = baseDayjs.year(components.get('year')!);
      if (components.get('month')) baseDayjs = baseDayjs.month(components.get('month')! - 1); // dayjs uses 0-indexed months
      if (components.get('day')) baseDayjs = baseDayjs.date(components.get('day')!);
    }

    // Apply time components if they were explicitly specified (certain)
    if (components.isCertain('hour')) {
      baseDayjs = baseDayjs.hour(components.get('hour')!);
    }
    if (components.isCertain('minute')) {
      baseDayjs = baseDayjs.minute(components.get('minute')!);
    }
    if (components.isCertain('second')) {
      baseDayjs = baseDayjs.second(components.get('second')!);
    }

    // If no time was specified, don't change the time (keep it as is)
    if (!components.isCertain('hour') && !components.isCertain('minute') && !components.isCertain('second')) {
      // For day-only expressions, we might want to set a default time or keep current time
      // For now, let's keep the current time for today/tomorrow/yesterday, but set to start of day for others
      if (originalText.includes('today') || originalText.includes('tomorrow') || originalText.includes('yesterday')) {
        // Keep the current time
      } else {
        // Set to start of day for other day-only expressions
        baseDayjs = baseDayjs.startOf('day');
      }
    }

    return baseDayjs.toDate();
  }

  private calculateConfidence(result: chrono.ParsedResult): number {
    const text = result.text.toLowerCase();
    // Base confidence from chrono's certainty
    let confidence = 0.7; // Start lower to allow for variations

    // Boost confidence for more specific patterns
    if (result.start.get('hour') !== null) confidence += 0.15;
    if (result.start.get('minute') !== null) confidence += 0.1;
    if (result.start.get('year') !== null) confidence += 0.1;

    // Reduce confidence for ambiguous patterns
    const ambiguousWords = ['sometime', 'maybe', 'perhaps', 'possibly', 'around', 'about', 'ish', 'kinda', 'sorta'];
    if (ambiguousWords.some(word => text.includes(word))) {
      confidence -= 0.4; // Larger penalty for ambiguous words
    }

    // Reduce confidence for very short matches that might be false positives
    if (result.text.length <= 3) {
      confidence -= 0.3;
    }

    // Boost confidence for clear temporal indicators
    const clearIndicators = ['tomorrow', 'yesterday', 'today', 'next week', 'last month'];
    if (clearIndicators.some(indicator => text.includes(indicator))) {
      confidence += 0.2;
    }

    return Math.min(Math.max(confidence, 0), 1);
  }

  private determineType(result: chrono.ParsedResult): 'absolute' | 'relative' {
    const text = result.text.toLowerCase();
    const relativeKeywords = [
      'today', 'tomorrow', 'yesterday',
      'next', 'last', 'this',
      'in', 'ago', 'later',
      'now', 'soon', 'recently',
      'week', 'month', 'year', 'day',
      'morning', 'afternoon', 'evening', 'night',
      'end of', 'beginning of', 'start of'
    ];

    const absoluteIndicators = [
      /\d{4}/, // Year (but only if not preceded by relative words)
      /\d{1,2}\/\d{1,2}\/\d{4}/, // MM/DD/YYYY format
      /\d{1,2}-\d{1,2}-\d{4}/, // MM-DD-YYYY format
      /january|february|march|april|may|june|july|august|september|october|november|december/,
      /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/
    ];

    // Strong relative indicators override everything
    const strongRelativeIndicators = [
      'end of', 'beginning of', 'start of',
      'next', 'last', 'this',
      'today', 'tomorrow', 'yesterday'
    ];

    if (strongRelativeIndicators.some(indicator => text.includes(indicator))) {
      return 'relative';
    }

    // Check for absolute indicators (but be more specific)
    if (absoluteIndicators.some(pattern => pattern.test(text))) {
      // Make sure it's not a relative expression with an absolute component
      if (!relativeKeywords.some(keyword => text.includes(keyword))) {
        return 'absolute';
      }
    }

    // Check for relative keywords
    return relativeKeywords.some(keyword => text.includes(keyword)) ? 'relative' : 'absolute';
  }

  private determineGrain(result: chrono.ParsedResult): 'day' | 'hour' | 'minute' | 'second' {
    // Use chrono's isCertain() method to determine what was explicitly specified vs implied
    // This is the correct way to distinguish user intent

    // Check for explicit (certain) time components in order of precision
    if (result.start.isCertain('second')) return 'second';
    if (result.start.isCertain('minute')) return 'minute';
    if (result.start.isCertain('hour')) return 'hour';

    // If no time components were explicitly specified, it's a day-level expression
    return 'day';
  }

  private setupCustomParsers(): void {
    // Add LLM-specific patterns that might be common in prompts

    // Business day patterns
    this.chronoInstance.parsers.push({
      pattern: () => /\b(next|this)\s+(business\s+day|workday|weekday)\b/i,
      extract: (context: any, match: any) => {
        const refDate = context.refDate;
        const isNext = match[1].toLowerCase() === 'next';

        let targetDate = new Date(refDate);
        let daysToAdd = 1;

        if (isNext) {
          // Find next business day
          do {
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            daysToAdd = 1;
          } while (targetDate.getDay() === 0 || targetDate.getDay() === 6); // Skip weekends
        } else {
          // Find this business day (today if it's a business day, otherwise next)
          if (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
            do {
              targetDate.setDate(targetDate.getDate() + daysToAdd);
              daysToAdd = 1;
            } while (targetDate.getDay() === 0 || targetDate.getDay() === 6);
          }
        }

        return {
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
          day: targetDate.getDate()
        };
      }
    } as any);

    // End of week/month patterns with better handling
    this.chronoInstance.parsers.push({
      pattern: () => /\b(end\s+of\s+(this\s+)?(week|month|quarter|year))\b/i,
      extract: (context: any, match: any) => {
        const refDate = context.refDate;
        const period = match[3].toLowerCase();
        const targetDate = new Date(refDate);

        switch (period) {
          case 'week':
            // Friday of current week
            const daysUntilFriday = (5 - targetDate.getDay() + 7) % 7;
            if (daysUntilFriday === 0 && targetDate.getDay() !== 5) {
              targetDate.setDate(targetDate.getDate() + 7); // Next Friday if today is not Friday
            } else {
              targetDate.setDate(targetDate.getDate() + daysUntilFriday);
            }
            break;
          case 'month':
            targetDate.setMonth(targetDate.getMonth() + 1, 0); // Last day of current month
            break;
          case 'quarter':
            const currentQuarter = Math.floor(targetDate.getMonth() / 3);
            targetDate.setMonth((currentQuarter + 1) * 3, 0);
            break;
          case 'year':
            targetDate.setFullYear(targetDate.getFullYear() + 1, 0, 0);
            break;
        }

        return {
          year: targetDate.getFullYear(),
          month: targetDate.getMonth() + 1,
          day: targetDate.getDate()
        };
      }
    } as any);
  }
}