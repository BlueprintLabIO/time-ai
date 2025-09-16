import { TimeAIConfig, EnhancedPrompt, DateExtraction, FormatStyle, ParsingOptions } from '../types';
import { TimeContextManager } from './time-context';
import { DateParser } from './date-parser';
import { DateFormatter } from './date-formatter';

export class TimeAI {
  private contextManager: TimeContextManager;
  private parser: DateParser;
  private formatter: DateFormatter;
  private config: Required<TimeAIConfig>;

  constructor(config: TimeAIConfig = {}) {
    // Get system defaults safely
    const getSystemDefaults = () => {
      try {
        if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
          const dtf = Intl.DateTimeFormat();
          return {
            timezone: dtf.resolvedOptions().timeZone,
            locale: dtf.resolvedOptions().locale
          };
        }
      } catch (error) {
        // Fallback if Intl is not available
      }
      return {
        timezone: 'UTC',
        locale: 'en-US'
      };
    };

    const defaults = getSystemDefaults();
    this.config = {
      timezone: config.timezone || defaults.timezone,
      locale: config.locale || defaults.locale,
      strategy: config.strategy || 'hybrid',
      includeContext: config.includeContext !== false // Default to true
    };

    this.contextManager = new TimeContextManager(this.config);
    this.parser = new DateParser();
    this.formatter = new DateFormatter(this.contextManager);
  }

  enhancePrompt(text: string, options?: { strategy?: 'preserve' | 'normalize' | 'hybrid' }): EnhancedPrompt {
    // Handle null/undefined input
    if (!text || typeof text !== 'string') {
      text = '';
    }

    const strategy = options?.strategy || this.config.strategy;

    // Parse dates from the text
    const extractions = this.parser.parse(text, {
      timezone: this.config.timezone,
      locale: this.config.locale,
      referenceDate: this.contextManager.getContext().now
    });

    // Build enhanced text based on strategy
    let enhancedText = text;
    let tokensAdded = 0;

    if (extractions.length > 0) {
      enhancedText = this.applyStrategy(text, extractions, strategy);
    }

    // Add temporal context if enabled
    let context = '';
    if (this.config.includeContext) {
      context = this.formatter.formatForLLMContext();
      tokensAdded += this.formatter.getTokenCount(context);
    }

    // Calculate additional tokens from enhancements
    const originalTokens = this.formatter.getTokenCount(text);
    const enhancedTokens = this.formatter.getTokenCount(enhancedText);
    tokensAdded += (enhancedTokens - originalTokens);

    return {
      originalText: text,
      enhancedText,
      context,
      extractions,
      tokensAdded
    };
  }

  parseDate(text: string, options?: ParsingOptions): DateExtraction | null {
    // Handle null/undefined input
    if (!text || typeof text !== 'string') {
      return null;
    }

    return this.parser.parseFirst(text, {
      timezone: this.config.timezone,
      locale: this.config.locale,
      referenceDate: this.contextManager.getContext().now,
      ...options
    });
  }

  parseDates(text: string, options?: ParsingOptions): DateExtraction[] {
    // Handle null/undefined input
    if (!text || typeof text !== 'string') {
      return [];
    }

    return this.parser.parse(text, {
      timezone: this.config.timezone,
      locale: this.config.locale,
      referenceDate: this.contextManager.getContext().now,
      ...options
    });
  }

  formatDate(date: Date, style: FormatStyle = 'human'): string {
    return this.formatter.format(date, style);
  }

  addContext(prompt: string): string {
    const context = this.formatter.formatForLLMContext();
    return `${context}\n\n${prompt}`;
  }

  setTimezone(timezone: string): void {
    this.config.timezone = timezone;
    this.contextManager.setTimezone(timezone);
  }

  setLocale(locale: string): void {
    this.config.locale = locale;
    this.contextManager.setLocale(locale);
  }

  getContext() {
    return this.contextManager.getContext();
  }

  private applyStrategy(
    text: string, 
    extractions: DateExtraction[], 
    strategy: 'preserve' | 'normalize' | 'hybrid'
  ): string {
    let result = text;
    
    // Sort extractions by position (descending) to avoid offset issues when replacing
    const sortedExtractions = [...extractions].sort((a, b) => b.start - a.start);

    for (const extraction of sortedExtractions) {
      const { originalText, resolvedDate, start, end } = extraction;
      let replacement: string;

      switch (strategy) {
        case 'preserve':
          // Keep original text as-is
          replacement = originalText;
          break;
        
        case 'normalize':
          // Replace with absolute date (with time if original had time reference)
          if (extraction.grain && extraction.grain !== 'day') {
            // Force include time and timezone for time-grain expressions
            const dateStr = resolvedDate.toISOString().split('T')[0]; // YYYY-MM-DD
            const timeStr = this.formatter['contextManager'].formatDateInTimezone(resolvedDate, {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            const context = this.formatter['contextManager'].getContext();
            replacement = `${dateStr} ${timeStr} ${context.timezone}`;
          } else {
            replacement = this.formatter.formatCompact(resolvedDate);
          }
          break;

        case 'hybrid':
          // Combine relative and absolute (with time if original had time reference)
          replacement = this.formatter.formatDateWithOriginal(resolvedDate, originalText, extraction.grain);
          break;
        
        default:
          replacement = originalText;
      }

      // Replace the text
      result = result.substring(0, start) + replacement + result.substring(end);
    }

    return result;
  }

  // Utility methods for common use cases
  
  isToday(date: Date): boolean {
    return this.contextManager.isToday(date);
  }

  isTomorrow(date: Date): boolean {
    return this.contextManager.isTomorrow(date);
  }

  getDaysDifference(date: Date): number {
    return this.contextManager.getDaysDifference(date);
  }

  // Legacy compatibility methods (matching your original time.ts)
  
  getCurrentTimeContext() {
    return this.contextManager.getContext();
  }

  formatDateForOpenAI(date: Date): string {
    return this.formatter.format(date, 'compact');
  }

  addDateContextToPrompt(prompt: string): string {
    return this.addContext(prompt);
  }
}