interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function PaginationBar({ page, limit, total, onPageChange }: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-40"
      >
        Previous
      </button>
      <span className="text-sm text-gray-400">
        Page {page} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="px-4 py-2 bg-[#1a1a24] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-white text-sm disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
