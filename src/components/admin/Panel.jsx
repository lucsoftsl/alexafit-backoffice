import RefreshButton from './RefreshButton'
import UpdatedAgo from './UpdatedAgo'

/**
 * A titled admin card with an optional per-card refresh button and
 * "updated X ago". While refreshing with data on screen the body dims
 * (crossfade) instead of being replaced by a spinner.
 */
const Panel = ({
  title,
  eyebrow,
  subtitle,
  actions,
  onRefresh,
  refreshing = false,
  refreshLabel,
  updatedAt,
  children,
  className = '',
  bodyClassName = '',
  as: Tag = 'section'
}) => (
  <Tag
    className={`min-w-0 rounded-3xl border border-slate-200 bg-white p-6 ${className}`}
  >
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">
            {eyebrow}
          </p>
        ) : null}
        {title ? (
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        ) : null}
        {subtitle ? (
          <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <UpdatedAgo at={updatedAt} />
        {onRefresh ? (
          <RefreshButton
            compact
            onClick={onRefresh}
            loading={refreshing}
            label={refreshLabel}
          />
        ) : null}
      </div>
    </header>
    <div
      className={`af-fade ${refreshing ? 'opacity-55' : 'opacity-100'} ${bodyClassName}`}
    >
      {children}
    </div>
  </Tag>
)

export default Panel
