import { FormatStyle, FormatOptions, TimeContext } from '../types';
import { TimeContextManager } from './time-context';

export class DateFormatter {
  private contextManager: TimeContextManager;

  constructor(contextManager: TimeContextManager) {
    this.contextManager = contextManager;
  }

  format(date: Date, style: FormatStyle, options: FormatOptions = {}): string {
    switch (style) {
      case 'context':
        return this.formatContext(date, options);
      case 'hybrid':
        return this.formatHybrid(date, options);
      case 'compact':
        return this.formatCompact(date);
      case 'human':
        return this.formatHuman(date, options);
      case 'iso':
        return this.formatISO(date);
      case 'relative':
        return this.formatRelative(date);
      default:
        return this.formatHuman(date, options);
    }
  }

  formatContext(date: Date, options: FormatOptions = {}): string {
    const context = this.contextManager.getContext();
    const parts: string[] = [];

    // Day reference
    if (this.contextManager.isToday(date)) {
      parts.push('Today');
    } else if (this.contextManager.isTomorrow(date)) {
      parts.push('Tomorrow');
    } else {
      const weekday = this.contextManager.formatDateInTimezone(date, { weekday: 'long' });
      parts.push(`${weekday}`);
    }

    // Add full date
    const fullDate = this.contextManager.formatDateInTimezone(date, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    parts.push(`is ${fullDate}`);

    // Add timezone if requested
    if (options.includeTimezone) {
      parts.push(`(${context.timezone})`);
    }

    return parts.join(' ');
  }

  formatHybrid(date: Date, options: FormatOptions = {}): string {
    const relative = this.formatRelative(date);
    const absolute = this.formatCompact(date);

    // For very specific relative dates like "today", "tomorrow", "yesterday", don't add redundant info
    const specificRelativeDates = ['today', 'tomorrow', 'yesterday'];
    if (specificRelativeDates.includes(relative.toLowerCase())) {
      return relative;
    }

    // If relative already contains the absolute date, don't duplicate
    if (relative.includes(absolute)) {
      return relative;
    }

    return `${relative} (${absolute})`;
  }

  formatCompact(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  formatHuman(date: Date, options: FormatOptions = {}): string {
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };

    if (options.includeWeekday) {
      formatOptions.weekday = 'long';
    }

    if (options.includeTime) {
      formatOptions.hour = 'numeric';
      formatOptions.minute = '2-digit';
    }

    return this.contextManager.formatDateInTimezone(date, formatOptions);
  }

  formatISO(date: Date): string {
    return date.toISOString();
  }

  formatRelative(date: Date): string {
    if (this.contextManager.isToday(date)) {
      return 'today';
    }

    if (this.contextManager.isTomorrow(date)) {
      return 'tomorrow';
    }

    const daysDiff = this.contextManager.getDaysDifference(date);

    if (daysDiff === -1) {
      return 'yesterday';
    }

    if (daysDiff > 0 && daysDiff <= 7) {
      const weekday = this.contextManager.formatDateInTimezone(date, { weekday: 'long' });
      return daysDiff <= 6 ? `this ${weekday}` : `next ${weekday}`;
    }

    if (daysDiff > 7 && daysDiff <= 14) {
      const weekday = this.contextManager.formatDateInTimezone(date, { weekday: 'long' });
      return `next ${weekday}`;
    }

    if (daysDiff > 0) {
      if (daysDiff <= 14) {
        // For dates within 2 weeks, prefer weekday names
        const weekday = this.contextManager.formatDateInTimezone(date, { weekday: 'long' });
        return `next ${weekday}`;
      } else if (daysDiff < 30) {
        return `in ${daysDiff} days`;
      } else if (daysDiff < 365) {
        const months = Math.round(daysDiff / 30);
        return `in ${months} month${months > 1 ? 's' : ''}`;
      } else {
        const years = Math.round(daysDiff / 365);
        return `in ${years} year${years > 1 ? 's' : ''}`;
      }
    }

    if (daysDiff < 0) {
      const absDays = Math.abs(daysDiff);
      if (absDays < 30) {
        return `${absDays} days ago`;
      } else if (absDays < 365) {
        const months = Math.round(absDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      } else {
        const years = Math.round(absDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      }
    }

    return this.formatCompact(date);
  }

  formatForLLMContext(date: Date = new Date()): string {
    const context = this.contextManager.getContext();
    const weekday = this.contextManager.formatDateInTimezone(date, { weekday: 'long' });
    const fullDate = this.formatCompact(date);
    const year = date.getFullYear();
    
    return `Current date: ${fullDate} (${weekday}, ${year})\nTimezone: ${context.timezone}`;
  }

  formatDateWithOriginal(date: Date, originalText: string): string {
    const compact = this.formatCompact(date);
    return `${originalText} (${compact})`;
  }

  getTokenCount(text: string): number {
    // Handle null/undefined input
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Handle empty string
    if (text.trim().length === 0) {
      return 0;
    }

    // Rough token estimation for LLM context
    // This is a simple heuristic - for more accuracy, use tiktoken or similar
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    return Math.ceil(words.length * 0.75);
  }
}