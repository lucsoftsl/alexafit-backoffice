import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon } from '@heroicons/react/24/outline'

import {
  changeCampaignStatus,
  duplicateCampaign
} from '../../services/orbHuntApi'
import { formatNumber } from '../../components/admin/format'

import CampaignEditor from './CampaignEditor'
import { ConfirmModal } from './Modal'
import {
  CAMPAIGN_STATUS_STYLE,
  TRANSITIONS,
  campaignTitle,
  formatDate
} from './model'
import {
  Badge,
  Button,
  EmptyState,
  SuccessBanner,
  TableShell,
  Td,
  Th
} from './ui'

const ACTION_TONE = { publish: 'success', end: 'danger', archive: 'secondary' }

const CampaignsTab = ({
  campaigns,
  loading,
  onChanged,
  onSelect,
  selectedId
}) => {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [editing, setEditing] = useState(null) // { id } | { id: null }
  const [confirm, setConfirm] = useState(null) // { action, campaign }
  const [notice, setNotice] = useState(null)

  if (editing) {
    return (
      <CampaignEditor
        campaignId={editing.id}
        onDone={detail => {
          setEditing(null)
          if (detail) {
            setNotice(
              t('admin.orbHunt.campaigns.saved', {
                title: campaignTitle(detail, lang)
              })
            )
            onSelect(detail.id)
            onChanged()
          }
        }}
      />
    )
  }

  const runAction = async () => {
    const { action, campaign } = confirm
    const detail =
      action === 'duplicate'
        ? await duplicateCampaign(campaign.id)
        : await changeCampaignStatus(campaign.id, action)
    setNotice(
      t(`admin.orbHunt.campaigns.done.${action}`, {
        title: campaignTitle(detail, lang)
      })
    )
    if (action === 'duplicate' || action === 'publish') onSelect(detail.id)
    onChanged()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {t('admin.orbHunt.campaigns.intro')}
        </p>
        <Button variant="primary" onClick={() => setEditing({ id: null })}>
          <PlusIcon className="h-4 w-4" />
          {t('admin.orbHunt.campaigns.new')}
        </Button>
      </div>

      {notice ? (
        <SuccessBanner onDismiss={() => setNotice(null)}>
          {notice}
        </SuccessBanner>
      ) : null}

      {!campaigns.length && !loading ? (
        <EmptyState
          title={t('admin.orbHunt.campaigns.emptyTitle')}
          hint={t('admin.orbHunt.campaigns.emptyHint')}
        />
      ) : (
        <TableShell caption={t('admin.orbHunt.tabs.campaigns')}>
          <thead>
            <tr>
              <Th>{t('admin.orbHunt.campaigns.campaign')}</Th>
              <Th>{t('admin.orbHunt.campaigns.status')}</Th>
              <Th>{t('admin.orbHunt.campaigns.dates')}</Th>
              <Th className="text-right">
                {t('admin.orbHunt.campaigns.slots')}
              </Th>
              <Th className="text-right">
                {t('admin.orbHunt.campaigns.participants')}
              </Th>
              <Th className="text-right">
                {t('admin.orbHunt.campaigns.wishesGranted')}
              </Th>
              <Th className="text-right">
                {t('admin.orbHunt.campaigns.actions')}
              </Th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map(campaign => (
              <tr
                key={campaign.id}
                className={`transition-colors hover:bg-violet-50/40 ${campaign.id === selectedId ? 'bg-violet-50/60' : ''}`}
              >
                <Td>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-8 shrink-0 rounded-full ring-2 ring-white shadow"
                      style={{ background: campaign.theme?.color || '#94a3b8' }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {campaignTitle(campaign, lang)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-slate-400">
                        {campaign.id}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Badge className={CAMPAIGN_STATUS_STYLE[campaign.status]}>
                    {t(`admin.orbHunt.status.${campaign.status}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDate(campaign.startsAt, lang)} →{' '}
                  {formatDate(campaign.endsAt, lang)}
                </Td>
                <Td className="af-num text-right">
                  {formatNumber(campaign.orbCount, lang)}
                </Td>
                <Td className="af-num text-right">
                  {formatNumber(campaign.participants, lang)}
                </Td>
                <Td className="af-num text-right">
                  {formatNumber(campaign.wishesGranted, lang)}
                </Td>
                <Td>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setEditing({ id: campaign.id })}
                    >
                      {campaign.status === 'ARCHIVED'
                        ? t('admin.orbHunt.campaigns.view')
                        : t('admin.orbHunt.campaigns.edit')}
                    </Button>
                    {(TRANSITIONS[campaign.status] || []).map(action => (
                      <Button
                        key={action}
                        size="sm"
                        variant={ACTION_TONE[action]}
                        onClick={() => setConfirm({ action, campaign })}
                      >
                        {t(`admin.orbHunt.campaigns.action.${action}`)}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirm({ action: 'duplicate', campaign })
                      }
                    >
                      {t('admin.orbHunt.campaigns.action.duplicate')}
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      {confirm ? (
        <ConfirmModal
          title={t(`admin.orbHunt.campaigns.confirm.${confirm.action}.title`)}
          message={t(
            `admin.orbHunt.campaigns.confirm.${confirm.action}.message`,
            {
              title: campaignTitle(confirm.campaign, lang)
            }
          )}
          confirmLabel={t(`admin.orbHunt.campaigns.action.${confirm.action}`)}
          tone={
            confirm.action === 'end'
              ? 'danger'
              : confirm.action === 'publish'
                ? 'success'
                : 'primary'
          }
          onConfirm={runAction}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </div>
  )
}

export default CampaignsTab
