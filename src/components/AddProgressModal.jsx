import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  XMarkIcon,
  CheckIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { saveUserCheckin, updateUserCheckin, deleteUserCheckin } from '../services/loggedinApi'

const AddProgressModal = ({ isOpen, onClose, userId, checkin, onSuccess }) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    checkInDateTime: new Date().toISOString().split('T')[0],
    currentWeightInKg: '',
    currentFatPercentage: '',
    currentWaistSizeInCm: '',
    currentChestSizeInCm: '',
    currentHipSizeInCm: '',
    currentThighSizeInCm: '',
    currentWaterPercentage: '',
    currentArmSizeInCm: ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Initialize form with checkin data if editing
  useEffect(() => {
    if (checkin) {
      const dateStr = new Date(checkin.checkInDateTime).toISOString().split('T')[0]
      setFormData({
        checkInDateTime: dateStr,
        currentWeightInKg: checkin.currentWeightInKg || '',
        currentFatPercentage: checkin.currentFatPercentage || '',
        currentWaistSizeInCm: checkin.currentWaistSizeInCm || '',
        currentChestSizeInCm: checkin.currentChestSizeInCm || '',
        currentHipSizeInCm: checkin.currentHipSizeInCm || '',
        currentThighSizeInCm: checkin.currentThighSizeInCm || '',
        currentWaterPercentage: checkin.currentWaterPercentage || '',
        currentArmSizeInCm: checkin.currentArmSizeInCm || ''
      })
    } else {
      setFormData({
        checkInDateTime: new Date().toISOString().split('T')[0],
        currentWeightInKg: '',
        currentFatPercentage: '',
        currentWaistSizeInCm: '',
        currentChestSizeInCm: '',
        currentHipSizeInCm: '',
        currentThighSizeInCm: '',
        currentWaterPercentage: '',
        currentArmSizeInCm: ''
      })
    }
    setError(null)
  }, [checkin, isOpen])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSave = async () => {
    if (!formData.currentWeightInKg) {
      setError(t('pages.progressModal.errors.weightRequired'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = {
        userId,
        checkInDateTime: new Date(formData.checkInDateTime).toISOString(),
        currentWeightInKg: parseFloat(formData.currentWeightInKg),
        currentFatPercentage: formData.currentFatPercentage ? parseFloat(formData.currentFatPercentage) : null,
        currentWaistSizeInCm: formData.currentWaistSizeInCm ? parseFloat(formData.currentWaistSizeInCm) : null,
        currentChestSizeInCm: formData.currentChestSizeInCm ? parseFloat(formData.currentChestSizeInCm) : null,
        currentHipSizeInCm: formData.currentHipSizeInCm ? parseFloat(formData.currentHipSizeInCm) : null,
        currentThighSizeInCm: formData.currentThighSizeInCm ? parseFloat(formData.currentThighSizeInCm) : null,
        currentWaterPercentage: formData.currentWaterPercentage ? parseFloat(formData.currentWaterPercentage) : null,
        currentArmSizeInCm: formData.currentArmSizeInCm ? parseFloat(formData.currentArmSizeInCm) : null
      }

      if (checkin) {
        payload.checkInId = checkin.id
        await updateUserCheckin(payload)
      } else {
        await saveUserCheckin(payload)
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error saving checkin:', err)
      setError(err.message || t('pages.progressModal.errors.saveFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      await deleteUserCheckin({
        userId,
        checkInId: checkin.id
      })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error deleting checkin:', err)
      setError(err.message || t('pages.progressModal.errors.deleteFailed'))
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 max-h-screen overflow-y-auto bg-white rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-purple-50/50 border-b border-purple-100">
          <h2 className="text-2xl font-bold text-gray-900">
            {checkin ? t('pages.progressModal.title.edit') : t('pages.progressModal.title.add')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('pages.progressModal.fields.date')}
            </label>
            <input
              type="date"
              name="checkInDateTime"
              value={formData.checkInDateTime}
              onChange={handleInputChange}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {t('pages.progressModal.fields.weightRequired')}
            </label>
            <input
              type="number"
              step="0.1"
              name="currentWeightInKg"
              value={formData.currentWeightInKg}
              onChange={handleInputChange}
              placeholder={t('pages.progressModal.placeholders.weight')}
              disabled={loading}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            />
          </div>

          {/* Grid for measurements */}
          <div className="grid grid-cols-2 gap-4">
            {/* Fat Percentage */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.fatPercentage')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentFatPercentage"
                value={formData.currentFatPercentage}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.fatPercentage')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Waist Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.waist')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentWaistSizeInCm"
                value={formData.currentWaistSizeInCm}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.waist')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Chest Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.chest')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentChestSizeInCm"
                value={formData.currentChestSizeInCm}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.chest')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Hip Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.hips')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentHipSizeInCm"
                value={formData.currentHipSizeInCm}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.hips')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Thigh Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.thigh')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentThighSizeInCm"
                value={formData.currentThighSizeInCm}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.thigh')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Arm Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.arm')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentArmSizeInCm"
                value={formData.currentArmSizeInCm}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.arm')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>

            {/* Water Percentage */}
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t('pages.progressModal.fields.water')}
              </label>
              <input
                type="number"
                step="0.1"
                name="currentWaterPercentage"
                value={formData.currentWaterPercentage}
                onChange={handleInputChange}
                placeholder={t('pages.progressModal.placeholders.water')}
                disabled={loading}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-800 font-semibold mb-3">{t('pages.progressModal.deleteConfirm.message')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleDelete()}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? t('pages.progressModal.actions.deleting') : t('pages.progressModal.deleteConfirm.confirm')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {t('pages.progressModal.deleteConfirm.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 p-6 bg-gray-50 border-t border-gray-200">
          {checkin && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              {t('pages.progressModal.actions.delete')}
            </button>
          )}
          <div className="flex-1 flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {t('pages.progressModal.actions.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <CheckIcon className="w-4 h-4" />
              {loading ? t('pages.progressModal.actions.saving') : checkin ? t('pages.progressModal.actions.update') : t('pages.progressModal.actions.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddProgressModal
