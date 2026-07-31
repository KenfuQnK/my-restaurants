export function formatRating(value?: number): string {
  if (value === undefined) return 'Sin puntuación';
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatReviewCount(value?: number): string {
  if (value === undefined) return 'Sin reseñas';
  return `${new Intl.NumberFormat('es-ES').format(value)} reseñas`;
}

export function humanizeType(value?: string): string {
  if (!value) return 'Restaurante';
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
