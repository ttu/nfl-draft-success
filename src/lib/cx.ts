/**
 * Joins class names, dropping falsy entries. Keeps optional BEM modifiers
 * readable at the call site: `cx('score-bar__fill', fillClass)` instead of a
 * nested template literal.
 */
export function cx(...classNames: (string | false | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}
