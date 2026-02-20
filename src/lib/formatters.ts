/**
 * French formatting utilities for currency, numbers, dates, and relative times.
 * All formatters use fr-FR locale for consistent French formatting.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const rtf = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' });
  const diffMs = d.getTime() - Date.now();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  
  // Less than a minute
  if (Math.abs(diffSeconds) < 60) {
    return 'À l\'instant';
  }
  
  // Less than an hour
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }
  
  // Less than a day
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  
  // Less than a month
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }
  
  // Less than a year
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month');
  }
  
  // More than a year
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(diffYears, 'year');
}

export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value)} %`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.', ',')} M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)} k`;
  }
  return formatNumber(value);
}

export function formatSurface(value: number): string {
  return `${formatNumber(value)} m²`;
}
