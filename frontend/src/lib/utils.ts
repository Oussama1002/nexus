import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Lateness in minutes → "0h25min". */
export const formatLateness = (minutes: number | null | undefined) => {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}min`;
};

/** MAD par défaut ; les montants publicitaires suivent la devise du compte Meta. */
export const formatCurrency = (amount: number, currency = 'MAD') => {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency,
  }).format(amount);
};
