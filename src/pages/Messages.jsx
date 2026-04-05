import { useTranslation } from 'react-i18next'
import Chat from './Chat'

function Messages() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">{t('pages.messages.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('pages.messages.subtitle')}</p>
      </div>
      <div className="flex-1 min-h-0">
        <Chat />
      </div>
    </div>
  )
}

export default Messages
