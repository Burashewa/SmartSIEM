import { useMemo, useState } from 'react';

export function usePagination(initialPage = 1, initialLimit = 20) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);

  const offset = useMemo(() => (page - 1) * limit, [page, limit]);

  return {
    page,
    limit,
    offset,
    setPage,
    setLimit,
  };
}
