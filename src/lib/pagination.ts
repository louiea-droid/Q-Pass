/** Page buttons for a pager, 1-based, always 7 slots or fewer: 1 … 9 10 11 … 41. */
export function pageList(page: number, total: number): (number | '…')[] {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  if (total <= 7) return range(1, total)
  if (page <= 4) return [...range(1, 5), '…', total]
  if (page >= total - 3) return [1, '…', ...range(total - 4, total)]
  return [1, '…', page - 1, page, page + 1, '…', total]
}
