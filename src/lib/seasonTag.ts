/** Two-digit season suffix, e.g. 2021 → "'21". */
export function seasonTag(year: number): string {
  return `'${String(year % 100).padStart(2, '0')}`;
}
