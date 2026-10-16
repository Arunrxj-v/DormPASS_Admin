/** Prev/next pagination driven by the API's page envelope. */
export function Pagination({
  page,
  pageSize,
  totalItems,
  hasNext,
  onPage,
  busy = false,
}: {
  page: number;
  pageSize: number;
  /** Exact item count on the current page (length of the fetched items). */
  totalItems: number;
  hasNext: boolean;
  onPage: (page: number) => void;
  busy?: boolean;
}) {
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + totalItems;

  return (
    <div className="pagination">
      <span className="tabular">
        {first}–{last}
      </span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1 || busy}
      >
        Previous
      </button>
      <span>Page {page}</span>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={!hasNext || busy}
      >
        Next
      </button>
    </div>
  );
}
