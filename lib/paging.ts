/** Rows per page in the admin tables — a screenful, so a long report stops being a scroll. */
export const PAGE_SIZE = 20;

export interface Page<T> {
  items: T[];
  /** 1-based, clamped into range — a stale ?page= past the end lands on the last page. */
  page: number;
  pages: number;
  /** 1-based positions of the first and last row shown; 0 and 0 when there are none. */
  from: number;
  to: number;
  total: number;
}

/** One page of `items`. `requested` is whatever the URL said, valid or not. */
export function pageOf<T>(items: T[], requested: unknown, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const asked = Math.floor(Number(requested));
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1;
  const start = (page - 1) * size;
  const shown = items.slice(start, start + size);
  return {
    items: shown,
    page,
    pages,
    from: shown.length ? start + 1 : 0,
    to: start + shown.length,
    total,
  };
}
