import { TimeContext, TimeAIConfig } from '../types';

export class TimeContextManager {
  private context: TimeContext;

  constructor(config: TimeAIConfig = {}) {
    this.context = {
      now: new Date(),
      timezone: this.validateTimezone(config.timezone) || this.getSystemTimezone(),
      locale: this.validateLocale(config.locale) || this.getSystemLocale()
    };
  }

  getContext(): TimeContext {
    return {
      ...this.context,
      now: new Date() // Always return current time
    };
  }

  setTimezone(timezone: string): void {
    const validTimezone = this.validateTimezone(timezone);
    if (validTimezone) {
      this.context.timezone = validTimezone;
    }
  }

  setLocale(locale: string): void {
    const validLocale = this.validateLocale(locale);
    if (validLocale) {
      this.context.locale = validLocale;
    }
  }

  updateNow(date?: Date): void {
    this.context.now = date || new Date();
  }

  private getSystemTimezone(): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
      }
    } catch (error) {
      // Fallback if Intl is not available
    }
    return 'UTC'; // Safe default
  }

  private getSystemLocale(): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return Intl.DateTimeFormat().resolvedOptions().locale;
      }
    } catch (error) {
      // Fallback if Intl is not available
    }
    return 'en-US'; // Safe default
  }

  formatDateInTimezone(date: Date, options?: Intl.DateTimeFormatOptions): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        return new Intl.DateTimeFormat(this.context.locale, {
          timeZone: this.context.timezone,
          ...options
        }).format(date);
      }
    } catch (error) {
      // Fallback if Intl is not available or timezone is invalid
    }

    // Simple fallback formatting
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  getTimezoneOffset(date: Date = new Date()): number {
    // Create dates in UTC and local timezone
    const utc = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
    const local = new Date(utc.toLocaleString('en-US', { timeZone: this.context.timezone }));
    
    return (utc.getTime() - local.getTime()) / 60000; // Return offset in minutes
  }

  isToday(date: Date): boolean {
    // Use the current time for calculations to ensure real-time accuracy
    const reference = this.getContext().now;

    const { year: refY, month: refM, day: refD } = this.getDatePartsInTimezone(reference);
    const { year: y, month: m, day: d } = this.getDatePartsInTimezone(date);

    return refY === y && refM === m && refD === d;
  }

  isTomorrow(date: Date): boolean {
    // Base relative calculations on the current context time to allow mocking via getContext()
    const tomorrow = new Date(this.getContext().now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { year: tY, month: tM, day: tD } = this.getDatePartsInTimezone(tomorrow);
    const { year: y, month: m, day: d } = this.getDatePartsInTimezone(date);

    return tY === y && tM === m && tD === d;
  }

  getDaysDifference(date: Date): number {
    // Base on internal reference time to respect updateNow()
    const now = this.context.now;
    const diffTime = date.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private getDatePartsInTimezone(date: Date): { year: number; month: number; day: number } {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat && (Intl as any).DateTimeFormat.prototype.formatToParts) {
        const parts = new Intl.DateTimeFormat(this.context.locale, {
          timeZone: this.context.timezone,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric'
        }).formatToParts(date);

        const year = Number(parts.find(p => p.type === 'year')?.value);
        const month = Number(parts.find(p => p.type === 'month')?.value);
        const day = Number(parts.find(p => p.type === 'day')?.value);

        return { year, month, day };
      }
    } catch (error) {
      // fall through to fallback
    }

    // Fallback: parse from ISO string (UTC based)
    const iso = date.toISOString().split('T')[0];
    const [y, m, d] = iso.split('-').map(Number);
    return { year: y, month: m, day: d };
  }

  private validateTimezone(timezone?: string): string | null {
    if (!timezone || typeof timezone !== 'string') {
      return null;
    }

    try {
      // Test if timezone is valid by trying to create a date formatter with it
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone });
        return timezone;
      }
    } catch (error) {
      // Invalid timezone, return null to use system default
    }
    return null;
  }

  private validateLocale(locale?: string): string | null {
    if (!locale || typeof locale !== 'string') {
      return null;
    }

    try {
      // Test if locale is valid by trying to create a date formatter with it
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        new Intl.DateTimeFormat(locale);
        return locale;
      }
    } catch (error) {
      // Invalid locale, return null to use system default
    }
    return null;
  }
}
