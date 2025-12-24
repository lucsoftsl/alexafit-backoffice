import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BookOpenIcon,
  SparklesIcon,
  ChartBarIcon,
  UserGroupIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline'

const glassCardClass = 'relative rounded-2xl border border-white/25 bg-white/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(15,23,42,0.08)]'
const glassSurfaceClass = 'rounded-2xl border border-white/40 bg-white/60 backdrop-blur-lg shadow-[0_10px_40px_rgba(15,23,42,0.06)]'

const TutorialCard = ({ icon: Icon, title, description, steps }) => {
  const displaySteps = Array.isArray(steps) ? steps.filter(Boolean) : []
  return (
    <div className={`${glassSurfaceClass} p-5 h-full flex flex-col gap-3`}>
      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-100 to-indigo-50 rounded-xl">
          <Icon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
      {displaySteps.length > 0 && (
        <ol className="space-y-2 text-sm text-gray-800 list-decimal list-inside">
          {displaySteps.map((step, idx) => (
            <li key={idx} className="leading-relaxed">{step}</li>
          ))}
        </ol>
      )}
    </div>
  )}

const Tutorials = () => {
  const { t } = useTranslation()

  const sections = useMemo(() => ([
    {
      id: 'myday',
      icon: SparklesIcon,
      title: t('pages.tutorials.sections.myDay.title'),
      description: t('pages.tutorials.sections.myDay.description'),
      steps: t('pages.tutorials.sections.myDay.steps', { returnObjects: true })
    },
    {
      id: 'userProgress',
      icon: ChartBarIcon,
      title: t('pages.tutorials.sections.userProgress.title'),
      description: t('pages.tutorials.sections.userProgress.description'),
      steps: t('pages.tutorials.sections.userProgress.steps', { returnObjects: true })
    },
    {
      id: 'clientProgress',
      icon: ChartBarIcon,
      title: t('pages.tutorials.sections.clientProgress.title'),
      description: t('pages.tutorials.sections.clientProgress.description'),
      steps: t('pages.tutorials.sections.clientProgress.steps', { returnObjects: true })
    },
    {
      id: 'myUsers',
      icon: UserGroupIcon,
      title: t('pages.tutorials.sections.myUsers.title'),
      description: t('pages.tutorials.sections.myUsers.description'),
      steps: t('pages.tutorials.sections.myUsers.steps', { returnObjects: true })
    },
    {
      id: 'clientProfile',
      icon: UserCircleIcon,
      title: t('pages.tutorials.sections.clientProfile.title'),
      description: t('pages.tutorials.sections.clientProfile.description'),
      steps: t('pages.tutorials.sections.clientProfile.steps', { returnObjects: true })
    },
    {
      id: 'clientJournal',
      icon: ClipboardDocumentListIcon,
      title: t('pages.tutorials.sections.clientJournal.title'),
      description: t('pages.tutorials.sections.clientJournal.description'),
      steps: t('pages.tutorials.sections.clientJournal.steps', { returnObjects: true })
    },
    {
      id: 'clientMealPlans',
      icon: CalendarDaysIcon,
      title: t('pages.tutorials.sections.clientMealPlans.title'),
      description: t('pages.tutorials.sections.clientMealPlans.description'),
      steps: t('pages.tutorials.sections.clientMealPlans.steps', { returnObjects: true })
    },
    {
      id: 'myMenus',
      icon: RectangleStackIcon,
      title: t('pages.tutorials.sections.myMenus.title'),
      description: t('pages.tutorials.sections.myMenus.description'),
      steps: t('pages.tutorials.sections.myMenus.steps', { returnObjects: true })
    }
  ]), [t])

  return (
    <div className="space-y-6">
      <div className={`${glassCardClass} p-6 sm:p-8 overflow-hidden`}>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-indigo-500/15 via-sky-500/15 to-emerald-500/15" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BookOpenIcon className="w-7 h-7 text-indigo-500" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('pages.tutorials.title')}</h1>
              <p className="text-gray-700 mt-1">{t('pages.tutorials.subtitle')}</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-white/70 border border-white/60 text-sm text-gray-700">
            {t('pages.tutorials.badge')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sections.map((section) => (
          <TutorialCard
            key={section.id}
            icon={section.icon}
            title={section.title}
            description={section.description}
            steps={section.steps}
          />
        ))}
      </div>
    </div>
  )
}

export default Tutorials
