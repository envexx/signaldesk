export function PageLoading() {
  return (
    <div className="loading-layout" aria-label="Loading demo data" aria-live="polite">
      <div className="skeleton skeleton--title" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="skeleton skeleton--card" key={index} />
        ))}
      </div>
      <div className="skeleton skeleton--panel" />
    </div>
  );
}

