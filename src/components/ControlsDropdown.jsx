import { useEffect, useRef, useState } from 'react'
import { WrenchScrewdriverIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslation } from 'react-i18next'

/**
 * ControlsDropdown — a single "Controls" button that opens a dropdown
 * listing all row actions as icon + translated label.
 *
 * @param {Array<{ icon: Component, labelKey: string, onClick: fn, colorClass?: string }>} actions
 * @param {boolean} absolute - when true, uses CSS absolute positioning relative to the wrapper
 *                             (use this when a backdrop-filter ancestor breaks position:fixed)
 */
const ControlsDropdown = ({ actions = [], absolute = false }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState({})
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const handleToggle = e => {
    e.stopPropagation()
    if (!absolute && !open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuWidth = 200
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow > 160 ? rect.bottom + 4 : rect.top - 4
      const translateY = spaceBelow > 160 ? 0 : -100
      const left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
      setStyle({
        position: 'fixed',
        top,
        left: Math.max(8, left),
        transform: `translateY(${translateY}%)`,
        zIndex: 9999,
        width: menuWidth
      })
    }
    setOpen(prev => !prev)
  }

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dropdown = open ? (
    <div
      ref={menuRef}
      style={absolute ? undefined : style}
      className={`rounded-xl border border-slate-200 bg-white py-1 shadow-lg ${
        absolute
          ? 'absolute right-0 top-full z-50 mt-1 w-48'
          : ''
      }`}
    >
      {actions.map((action, i) => {
        const Icon = action.icon
        const isDisabled = action.disabled || action.loading
        return (
          <button
            key={i}
            type="button"
            disabled={isDisabled}
            onClick={e => {
              e.stopPropagation()
              setOpen(false)
              action.onClick()
            }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-40 disabled:cursor-not-allowed ${isDisabled ? '' : 'hover:bg-slate-50'} ${action.colorClass || 'text-slate-700'}`}
          >
            {action.loading
              ? <ArrowPathIcon className="h-4 w-4 shrink-0 animate-spin" />
              : <Icon className="h-4 w-4 shrink-0" />
            }
            {t(action.labelKey)}
          </button>
        )
      })}
    </div>
  ) : null

  if (absolute) {
    return (
      <div className="relative inline-block">
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none"
        >
          <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-slate-500" />
          {t('common.controls.label')}
        </button>
        {dropdown}
      </div>
    )
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none"
      >
        <WrenchScrewdriverIcon className="h-3.5 w-3.5 text-slate-500" />
        {t('common.controls.label')}
      </button>
      {dropdown}
    </>
  )
}

export default ControlsDropdown
