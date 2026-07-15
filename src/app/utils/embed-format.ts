import { EmbedConfig } from '../models/embed.model';

export const isDateField = (name: string): boolean => name.trim().toLowerCase() === 'fi';

export const isCodeField = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'codi' ||
    normalized === 'codigo' ||
    normalized === 'código' ||
    normalized === 'code'
  );
};

export const isPriceField = (name: string): boolean => name.trim().toLowerCase() === 'preu';

export const formatDateValue = (value: string | null | undefined): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

export const normalizeDateInputValue = (name: string, value: string): string => {
  if (!isDateField(name)) {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

export const formatPrice = (price: string): string => {
  const normalized = price.trim().replace(/[$€£]/g, '').trim();
  return normalized ? `€${normalized}` : '';
};

export const formatStrikethroughPrice = (price: string): string => {
  const formatted = formatPrice(price);
  return formatted ? `~~${formatted}~~ GRATIS` : '';
};

export const formatEmbedForPreview = (embed: EmbedConfig): EmbedConfig => ({
  ...embed,
  fields: embed.fields.map((field) =>
    isDateField(field.name) ? { ...field, value: formatDateValue(field.value) } : field
  ),
});

export const toHexColor = (color: number | null | undefined): string => {
  const safeColor = typeof color === 'number' ? color : 0;
  return `#${safeColor.toString(16).padStart(6, '0')}`;
};

export const fromHexColor = (hex: string): number => {
  const parsed = Number.parseInt(hex.replace('#', ''), 16);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const formatFieldValueHtml = (value: string | null | undefined): string =>
  escapeHtml(value ?? '').replace(/~~(.*?)~~/g, '<span class="strike">$1</span>');
