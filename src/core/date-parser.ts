import * as chrono from 'chrono-node';
import { DateExtraction, ParsingOptions, TimeContext } from '../types';

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
    
    return results.map(result => this.convertChronoResult(result, text));
  }

  parseFirst(text: string, options: ParsingOptions = {}): DateExtraction | null {
    const results = this.parse(text, options);
    return results.length > 0 ? results[0] : null;
  }

  extractDates(text: string, options: ParsingOptions = {}): DateExtraction[] {
    return this.parse(text, options);
  }

  private convertChronoResult(result: chrono.ParsedResult, originalText: string): DateExtraction {
    const startDate = result.start.date();
    const confidence = this.calculateConfidence(result);
    const type = this.determineType(result);
    const grain = this.determineGrain(result);

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
    const text = result.text.toLowerCase();

    // Check for explicit time indicators in the text first (more reliable)
    if (text.includes('second') || /:\d{2}:\d{2}/.test(text)) return 'second';
    if (text.includes('minute') || (text.includes(':') && /\d{1,2}:\d{2}/.test(text))) return 'minute';
    if (text.includes('am') || text.includes('pm') || text.includes('hour') ||
        /\d{1,2}\s*(am|pm)/.test(text) || /\d{1,2}:\d{2}/.test(text)) return 'hour';

    // For simple time-less expressions, return day
    const dayOnlyExpressions = ['today', 'tomorrow', 'yesterday', 'next week', 'last week', 'next month'];
    if (dayOnlyExpressions.some(expr => text.includes(expr))) {
      return 'day';
    }

    // Check what chrono actually parsed as a fallback
    if (result.start.get('second') !== null && result.start.get('second') !== undefined) return 'second';
    if (result.start.get('minute') !== null && result.start.get('minute') !== undefined) return 'minute';
    if (result.start.get('hour') !== null && result.start.get('hour') !== undefined) return 'hour';

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