/** Shimmer placeholder; `lines` renders a stack of text-height bars. */
const Skeleton = ({ className = 'h-4 w-full', lines = 0 }) => {
  if (lines > 0) {
    return (
      <div className="space-y-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="af-skeleton h-3"
            style={{ width: `${92 - ((i * 17) % 40)}%` }}
          />
        ))}
      </div>
    )
  }
  return <div className={`af-skeleton ${className}`} aria-hidden="true" />
}

export default Skeleton
