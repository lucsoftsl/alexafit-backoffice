import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import L from 'leaflet'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMapEvents
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

import { getCampaign, getHeatmap } from '../../services/orbHuntApi'

import { ApiError } from './Modal'
import PinForm from './PinForm'
import { Badge, Card, SuccessBanner } from './ui'
import useOrbResource from './useOrbResource'

// Vite fingerprints asset URLs, which breaks Leaflet's default icon path
// lookup; give every marker an explicit icon built from the bundled images.
const pinIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  tooltipAnchor: [12, -28],
  shadowSize: [41, 41]
})

const DEFAULT_CENTER = [45.9432, 24.9668]
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 12
const DEFAULT_RADIUS_M = 100
// Only GPS catches have a location: explore (REGULAR) and pin orbs.
const KIND_COLOR = { REGULAR: '#6250d6', PIN: '#2a78d6' }

const heatRadius = count => Math.min(28, 5 + 4 * Math.sqrt(count))

const ClickToPlace = ({ onPlace }) => {
  useMapEvents({ click: event => onPlace(event.latlng) })
  return null
}

const emptyPin = ({ lat, lng }) => ({
  id: null,
  name: '',
  description: '',
  lat: Number(lat.toFixed(6)),
  lng: Number(lng.toFixed(6)),
  radiusM: DEFAULT_RADIUS_M,
  activeFrom: null,
  activeTo: null,
  isActive: true
})

const MapTab = ({ campaignId }) => {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState(null)
  const [showPins, setShowPins] = useState(true)
  const [showHeat, setShowHeat] = useState(true)
  const [notice, setNotice] = useState(null)

  const detail = useOrbResource(
    signal => getCampaign(campaignId, { signal }),
    campaignId
  )
  const heat = useOrbResource(
    signal => getHeatmap(campaignId, { signal }),
    campaignId
  )
  const pins = useMemo(() => detail.data?.pins || [], [detail.data])
  const cells = useMemo(() => heat.data || [], [heat.data])

  // Centre once on the first pin or busiest cell; MapContainer ignores later changes.
  const center = useMemo(() => {
    if (pins[0]) return [pins[0].lat, pins[0].lng]
    const top = [...cells].sort((a, b) => b.count - a.count)[0]
    return top ? [top.lat, top.lng] : DEFAULT_CENTER
  }, [pins, cells])
  const ready = !detail.loading || detail.data

  const replacePin = saved =>
    detail.setData(prev => {
      const list = prev?.pins || []
      const exists = list.some(p => p.id === saved.id)
      return {
        ...prev,
        pins: exists
          ? list.map(p => (p.id === saved.id ? { ...p, ...saved } : p))
          : [...list, saved]
      }
    })

  return (
    <div className="space-y-4">
      <ApiError error={detail.error} />
      <ApiError error={heat.error} />
      {notice ? (
        <SuccessBanner onDismiss={() => setNotice(null)}>
          {notice}
        </SuccessBanner>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {t('admin.orbHunt.map.intro')}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showPins}
                  onChange={e => setShowPins(e.target.checked)}
                  className="accent-violet-700"
                />
                {t('admin.orbHunt.map.showPins')}
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showHeat}
                  onChange={e => setShowHeat(e.target.checked)}
                  className="accent-violet-700"
                />
                {t('admin.orbHunt.map.showHeat')}
              </label>
            </div>
          </div>
          <div className="relative z-0 h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-100">
            {ready ? (
              <MapContainer
                center={center}
                zoom={pins.length || cells.length ? PIN_ZOOM : DEFAULT_ZOOM}
                className="h-full w-full"
                scrollWheelZoom
              >
                <TileLayer
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={19}
                />
                <ClickToPlace onPlace={latlng => setDraft(emptyPin(latlng))} />
                {showHeat
                  ? cells.map(cell => (
                      <CircleMarker
                        key={`${cell.lat}:${cell.lng}:${cell.kind}`}
                        center={[cell.lat, cell.lng]}
                        radius={heatRadius(cell.count)}
                        pathOptions={{
                          color: KIND_COLOR[cell.kind] || '#64748b',
                          fillOpacity: 0.35,
                          weight: 1
                        }}
                        bubblingMouseEvents={false}
                      >
                        <Tooltip>
                          {t(`admin.orbHunt.kinds.${cell.kind}`)}: {cell.count}
                        </Tooltip>
                      </CircleMarker>
                    ))
                  : null}
                {showPins
                  ? pins
                      .filter(pin => pin.id !== draft?.id)
                      .map(pin => (
                        <Fragment key={pin.id}>
                          <Circle
                            center={[pin.lat, pin.lng]}
                            radius={pin.radiusM}
                            interactive={false}
                            pathOptions={{
                              color: pin.isActive ? '#2a78d6' : '#94a3b8',
                              weight: 1.5,
                              fillOpacity: 0.12
                            }}
                          />
                          <Marker
                            position={[pin.lat, pin.lng]}
                            icon={pinIcon}
                            opacity={pin.isActive ? 1 : 0.45}
                            eventHandlers={{
                              click: () => setDraft({ ...pin })
                            }}
                          >
                            <Tooltip>
                              {pin.name}
                              {pin.isActive
                                ? ''
                                : ` (${t('admin.orbHunt.map.inactive')})`}
                            </Tooltip>
                          </Marker>
                        </Fragment>
                      ))
                  : null}
                {draft &&
                Number.isFinite(draft.lat) &&
                Number.isFinite(draft.lng) ? (
                  <>
                    <Marker position={[draft.lat, draft.lng]} icon={pinIcon} />
                    <Circle
                      center={[draft.lat, draft.lng]}
                      radius={draft.radiusM || DEFAULT_RADIUS_M}
                      interactive={false}
                      pathOptions={{
                        color: '#6d28d9',
                        weight: 2,
                        dashArray: '6 4',
                        fillOpacity: 0.15
                      }}
                    />
                  </>
                ) : null}
              </MapContainer>
            ) : (
              <div className="af-skeleton h-full w-full" />
            )}
          </div>
          <ul className="flex flex-wrap gap-4 text-xs text-slate-600">
            {Object.entries(KIND_COLOR).map(([kind, color]) => (
              <li key={kind} className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: color, opacity: 0.6 }}
                  aria-hidden="true"
                />
                {t('admin.orbHunt.map.heatKind', {
                  kind: t(`admin.orbHunt.kinds.${kind}`)
                })}
              </li>
            ))}
            <li className="text-slate-500">
              {t('admin.orbHunt.map.heatPrivacy')}
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <Card>
            {draft ? (
              <PinForm
                key={draft.id || 'new'}
                campaignId={campaignId}
                pin={draft}
                onChange={setDraft}
                onCancel={() => setDraft(null)}
                onSaved={(saved, kind) => {
                  replacePin(saved)
                  setDraft(null)
                  setNotice(
                    t(`admin.orbHunt.map.done.${kind}`, { name: saved.name })
                  )
                }}
                onDeleted={(pin, outcome) => {
                  setDraft(null)
                  setNotice(
                    t(
                      `admin.orbHunt.map.done.${outcome === 'DEACTIVATED' ? 'deactivated' : 'deleted'}`,
                      { name: pin.name }
                    )
                  )
                  detail.reload()
                }}
              />
            ) : (
              <p className="text-sm text-slate-600">
                {t('admin.orbHunt.map.pickHint')}
              </p>
            )}
          </Card>

          <Card title={t('admin.orbHunt.map.pins', { count: pins.length })}>
            {!pins.length ? (
              <p className="text-sm text-slate-500">
                {t('admin.orbHunt.map.noPins')}
              </p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {pins.map(pin => (
                  <li key={pin.id}>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...pin })}
                      className={`af-focus flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 ${
                        draft?.id === pin.id ? 'bg-violet-50' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {pin.name}
                        </span>
                        <span className="af-num text-xs text-slate-500">
                          {pin.radiusM} m ·{' '}
                          {t('admin.orbHunt.map.catches', {
                            count: pin.catches || 0
                          })}
                        </span>
                      </span>
                      <Badge
                        className={
                          pin.isActive
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-600/25'
                            : 'bg-slate-100 text-slate-600 ring-slate-400/25'
                        }
                      >
                        {pin.isActive
                          ? t('admin.orbHunt.map.active')
                          : t('admin.orbHunt.map.inactive')}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <p className="text-xs text-slate-500" lang={i18n.language}>
            {t('admin.orbHunt.map.tilesNote')}
          </p>
        </div>
      </div>
    </div>
  )
}

export default MapTab
