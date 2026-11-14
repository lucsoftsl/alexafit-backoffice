import { useTranslation } from 'react-i18next'
import { ClockIcon } from '@heroicons/react/24/outline'

import { formatDateTime } from '../orbHunts/model'
import { Badge } from '../orbHunts/ui'

import ModerationActions from './ModerationActions'
import PostPreview from './PostPreview'
import UserChip from './UserChip'
import { REASON_STYLE, isOverdue } from './model'

/** One report in the moderation queue: reason, reporter, target, actions. */
const ReportCard = ({ report, isOpen, onDone, onFilterUser }) => {
  const { t, i18n } = useTranslation()
  const overdue = isOpen && isOverdue(report.createdAt)
  const post = report.post
  const targetUser = report.targetUser
  return (
    <section
      className={`rounded-3xl border bg-white p-5 transition-shadow hover:shadow-md ${
        overdue
          ? 'border-rose-300 shadow-sm shadow-rose-900/5'
          : 'border-slate-200'
      }`}
      aria-label={t(`admin.theTable.reasons.${report.reason}`, {
        defaultValue: report.reason
      })}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={REASON_STYLE[report.reason] || REASON_STYLE.OTHER}
            >
              {t(`admin.theTable.reasons.${report.reason}`, {
                defaultValue: report.reason
              })}
            </Badge>
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {post
                ? t('admin.theTable.reports.targetPost')
                : t('admin.theTable.reports.targetUser')}
            </span>
            {report.otherReportCount ? (
              <span className="af-num text-xs text-slate-500">
                {t('admin.theTable.reports.otherReports', {
                  count: report.otherReportCount
                })}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-slate-500">
            {t('admin.theTable.reports.reportedBy')}{' '}
            <UserChip user={report.reporter} onFilterUser={onFilterUser} />
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            overdue ? 'font-semibold text-rose-700' : 'text-slate-500'
          }`}
        >
          <ClockIcon className="h-4 w-4" aria-hidden="true" />
          <time dateTime={report.createdAt}>
            {formatDateTime(report.createdAt, i18n.language)}
          </time>
          {overdue ? ` · ${t('admin.theTable.reports.overdue')}` : null}
        </span>
      </header>

      {report.details ? (
        <blockquote className="mt-3 border-l-2 border-violet-300 pl-3 text-sm italic text-slate-700">
          {report.details}
        </blockquote>
      ) : null}

      <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
        {post ? (
          <PostPreview post={post} onFilterUser={onFilterUser} />
        ) : targetUser ? (
          <UserChip user={targetUser} onFilterUser={onFilterUser} showBan />
        ) : (
          <p className="text-sm text-slate-500">
            {t('admin.theTable.reports.targetGone')}
          </p>
        )}
      </div>

      <footer className="mt-4">
        <ModerationActions
          post={post}
          user={post ? post.author : targetUser}
          reportId={report.id}
          canDismiss={isOpen}
          onDone={onDone}
        />
      </footer>
    </section>
  )
}

export default ReportCard
