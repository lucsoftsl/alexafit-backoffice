import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { selectUserData } from '../store/userSlice'
import { getUserCheckins } from '../services/loggedinApi'
import ProgressChart from '../components/ProgressChart'
import {
  ArrowPathIcon,
  ChartBarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import AddProgressModal from '../components/AddProgressModal'
import { PencilIcon, PlusIcon } from '@heroicons/react/24/outline'

const UserProgress = () => {
  const userData = useSelector(selectUserData)
  const [checkins, setCheckins] = useState([])
  const [filteredCheckins, setFilteredCheckins] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState(30)
  const [showFilters, setShowFilters] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState(null)
  const [lastWeight, setLastWeight] = useState(null)
  const [lastFat, setLastFat] = useState(null)
  const [lastWaist, setLastWaist] = useState(null)
  const [lastChest, setLastChest] = useState(null)
  const [goal, setGoal] = useState(null)
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('desc')
  const [expandedMeasurements, setExpandedMeasurements] = useState({})
  const chartRefs = useRef({})

  useEffect(() => {
    fetchCheckins()
  }, [userData?.userId])

  const fetchCheckins = async () => {
    if (!userData?.userId) return

    setLoading(true)
    setError(null)
    try {
      const response = await getUserCheckins({ userId: userData.userId })
      // Handle response structure from /foodsync/getUserProgress endpoint
      const data = response?.data?.data?.data?.measurements || response?.data?.data?.measurements || []
      const goalData = response?.data?.data?.data?.goal || response?.data?.data?.goal || null
      const sorted = Array.isArray(data) ? data.sort((a, b) => new Date(b.checkInDateTime).getTime() - new Date(a.checkInDateTime).getTime()) : []
      setCheckins(sorted)
      setGoal(goalData)
      calculateLastMeasurements(sorted)
    } catch (err) {
      console.error('Error fetching checkins:', err)
      setError('Failed to load progress data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    filterCheckinsByDateRange()
  }, [checkins, selectedFilter])

  useEffect(() => {
    // Auto-scroll charts to the right when filter changes
    Object.keys(chartRefs.current).forEach(key => {
      const container = chartRefs.current[key]
      if (container) {
        setTimeout(() => {
          container.scrollLeft = container.scrollWidth
        }, 100)
      }
    })
  }, [selectedFilter, filteredCheckins])

  const filterCheckinsByDateRange = () => {
    const today = new Date()
    const pastDate = new Date(today.getTime() - selectedFilter * 24 * 60 * 60 * 1000)

    const filtered = checkins.filter((checkin) => {
      const checkinDate = new Date(checkin.checkInDateTime)
      return checkinDate >= pastDate && checkin.currentWeightInKg
    })

    setFilteredCheckins(filtered)
  }

  const getStats = () => {
    if (filteredCheckins.length === 0) return null

    const ordered = [...filteredCheckins].sort((a, b) => new Date(a.checkInDateTime) - new Date(b.checkInDateTime))
    const weights = ordered
      .map(c => c.currentWeightInKg)
      .filter(w => w !== null && w !== undefined && w !== '')
      .map(w => parseFloat(w))

    if (weights.length === 0) return null

    const startWeight = weights[0]
    const currentWeight = weights[weights.length - 1]
    const minWeight = Math.min(...weights)
    const maxWeight = Math.max(...weights)
    const avgWeight = (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1)
    const change = (currentWeight - startWeight).toFixed(1)

    return {
      current: currentWeight.toFixed(1),
      start: startWeight.toFixed(1),
      min: minWeight.toFixed(1),
      max: maxWeight.toFixed(1),
      avg: avgWeight,
      change: change,
      isIncreased: parseFloat(change) > 0,
      entries: weights.length
    }
  }

  const stats = getStats()

  const goalInfo = useMemo(() => {
    if (!goal || !stats) return null
    const type = goal.goalType
    const target = parseFloat(goal.targetWeight)
    const original = parseFloat(goal.originalWeight)
    const current = parseFloat(stats.current)
    const remaining = (type === 'LOSE_WEIGHT' ? current - target : target - current).toFixed(1)
    return { type, target, original, current, remaining }
  }, [goal, stats])

  const checkLastOneWithValues = (key, list) => {
    for (let i = 0; i < list.length; i++) {
      if (list[i][key] && list[i][key] !== null && list[i][key] !== '') {
        return list[i]
      }
    }
    return null
  }

  const calculateLastMeasurements = (allCheckins) => {
    if (allCheckins.length > 0) {
      setLastWeight(checkLastOneWithValues('currentWeightInKg', allCheckins))
      setLastFat(checkLastOneWithValues('currentFatPercentage', allCheckins))
      setLastWaist(checkLastOneWithValues('currentWaistSizeInCm', allCheckins))
      setLastChest(checkLastOneWithValues('currentChestSizeInCm', allCheckins))
    }
  }

  const openAddModal = () => {
    setSelectedCheckin(null)
    setModalOpen(true)
  }

  const openEditModal = (checkin) => {
    setSelectedCheckin(checkin)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedCheckin(null)
  }

  const handleModalSuccess = () => {
    fetchCheckins()
  }

  const toggleMeasurement = (measurement) => {
    setExpandedMeasurements(prev => {
      const newState = {
        ...prev,
        [measurement]: !prev[measurement]
      }
      // If opening (expanding), scroll chart to the right after DOM updates
      if (!prev[measurement]) { // Opening
        setTimeout(() => {
          const container = chartRefs.current[measurement]
          if (container) {
            container.scrollLeft = container.scrollWidth
          }
        }, 0)
      }
      return newState
    })
  }

  const getLatestMeasurement = (field) => {
    const ordered = [...filteredCheckins].sort((a, b) => new Date(b.checkInDateTime) - new Date(a.checkInDateTime))
    const entry = ordered.find(c => c[field] && c[field] !== null && c[field] !== '')
    return entry ? parseFloat(entry[field]) : null
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredCheckins]
    if (sortBy === 'date') {
      sorted.sort((a, b) => {
        const dateA = new Date(a.checkInDateTime).getTime()
        const dateB = new Date(b.checkInDateTime).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      })
    } else if (sortBy === 'weight') {
      sorted.sort((a, b) => {
        const weightA = parseFloat(a.currentWeightInKg || 0)
        const weightB = parseFloat(b.currentWeightInKg || 0)
        return sortOrder === 'asc' ? weightA - weightB : weightB - weightA
      })
    }
    return sorted
  }, [filteredCheckins, sortBy, sortOrder])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 bg-gradient-to-br from-purple-100 to-purple-50 rounded-2xl">
                <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Weight Progress</h1>
                <p className="text-sm sm:text-base text-gray-600 mt-0.5 sm:mt-1">Track your weight and health metrics</p>
              </div>
            </div>
            <div className="flex w-full sm:w-auto gap-2 sm:gap-3 flex-col sm:flex-row">
              <button
                onClick={openAddModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                Add Entry
              </button>
              <button
                onClick={fetchCheckins}
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            {error}
          </div>
        )}

        {/* Goal Card */}
        {goalInfo && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-xl border border-white/20 p-5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Goal</p>
              <p className="mt-2 text-xl font-bold text-gray-900">{goalInfo.type?.replace(/_/g, ' ')}</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-xl border border-white/20 p-5">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Target Weight</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{goalInfo.target.toFixed(1)}</p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-green-50/50 to-green-100/30 backdrop-blur-xl border border-white/20 p-5">
              <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Remaining</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{goalInfo.remaining}</p>
              <p className="text-xs text-gray-500">kg</p>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {/* Current Weight */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-sm border border-purple-200/30 p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-600/0 group-hover:from-purple-500/5 group-hover:to-purple-600/5 transition-all duration-300"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Current</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.current}</p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>

            {/* Start Weight */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm border border-blue-200/30 p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-600/0 group-hover:from-blue-500/5 group-hover:to-blue-600/5 transition-all duration-300"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Start</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.start}</p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>

            {/* Average Weight */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-50/50 to-cyan-100/30 backdrop-blur-sm border border-cyan-200/30 p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-600/0 group-hover:from-cyan-500/5 group-hover:to-cyan-600/5 transition-all duration-300"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-cyan-600 uppercase tracking-wider">Average</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.avg}</p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>

            {/* Min Weight */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50/50 to-green-100/30 backdrop-blur-sm border border-green-200/30 p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-green-600/0 group-hover:from-green-500/5 group-hover:to-green-600/5 transition-all duration-300"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Minimum</p>
                <p className="mt-2 text-2xl font-bold text-gray-900">{stats.min}</p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>

            {/* Change */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50/50 to-rose-100/30 backdrop-blur-sm border border-rose-200/30 p-5 hover:shadow-lg transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-500/0 to-rose-600/0 group-hover:from-rose-500/5 group-hover:to-rose-600/5 transition-all duration-300"></div>
              <div className="relative">
                <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Change</p>
                <p className={`mt-2 text-2xl font-bold ${stats.isIncreased ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.isIncreased ? '+' : ''}{stats.change}
                </p>
                <p className="text-xs text-gray-500">kg</p>
              </div>
            </div>
          </div>
        )}

        {/* Period Filter */}
        <div className="mb-6">
          <div className="flex items-center justify-between p-4 bg-white/50 backdrop-blur-md border border-white/20 rounded-2xl">
            <div>
              <p className="text-sm font-semibold text-gray-900">Time Period</p>
              <p className="text-xs text-gray-500">Filter data by date range</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-medium hover:shadow-lg transition-all"
            >
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { days: 14, label: '14 Days' },
                { days: 30, label: '1 Month' },
                { days: 90, label: '3 Months' },
                { days: 180, label: '6 Months' },
                { days: 365, label: '1 Year' }
              ].map(({ days, label }) => (
                <button
                  key={days}
                  onClick={() => setSelectedFilter(days)}
                  className={`py-3 px-4 rounded-xl font-medium transition-all ${
                    selectedFilter === days
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                      : 'bg-white/50 backdrop-blur-md border border-white/20 text-gray-700 hover:bg-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chart */}
        {loading ? (
          <div className="flex items-center justify-center h-80 bg-white/50 backdrop-blur-md rounded-3xl border border-white/20">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3"></div>
              <p className="text-gray-600">Loading progress data...</p>
            </div>
          </div>
        ) : filteredCheckins.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Measurements Overview</h2>
            <div className="grid grid-cols-1 gap-4">
              {/* Weight */}
              <div className="rounded-3xl bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-xl border border-white/20 shadow-xl overflow-hidden">
                <button
                  onClick={() => toggleMeasurement('weight')}
                  className="w-full p-5 flex items-center justify-between hover:bg-white/30 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                    <div className="text-left">
                      <h3 className="text-base font-semibold text-gray-900">Weight</h3>
                      <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentWeightInKg')?.toFixed(1) || '-'} kg</p>
                    </div>
                  </div>
                  <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.weight ? 'rotate-90' : ''}`} />
                </button>
                {expandedMeasurements.weight && (
                  <div className="px-5 pb-5">
                    <div className="overflow-x-auto" ref={el => chartRefs.current.weight = el}>
                      <ProgressChart data={filteredCheckins} measurement="currentWeightInKg" unit="kg" />
                    </div>
                  </div>
                )}
              </div>

              {/* Fat Percentage */}
              {filteredCheckins.some(c => c.currentFatPercentage) && (
                <div className="rounded-3xl bg-gradient-to-br from-orange-50/60 to-orange-100/30 backdrop-blur-xl border border-orange-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('fat')}
                    className="w-full p-5 flex items-center justify-between hover:bg-orange-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Body Fat</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentFatPercentage')?.toFixed(1) || '-'} %</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.fat ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.fat && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.fat = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentFatPercentage" unit="%" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Water Percentage */}
              {filteredCheckins.some(c => c.currentWaterPercentage) && (
                <div className="rounded-3xl bg-gradient-to-br from-blue-50/60 to-blue-100/30 backdrop-blur-xl border border-blue-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('water')}
                    className="w-full p-5 flex items-center justify-between hover:bg-blue-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Water</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentWaterPercentage')?.toFixed(1) || '-'} %</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.water ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.water && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.water = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentWaterPercentage" unit="%" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Waist */}
              {filteredCheckins.some(c => c.currentWaistSizeInCm) && (
                <div className="rounded-3xl bg-gradient-to-br from-emerald-50/60 to-emerald-100/30 backdrop-blur-xl border border-emerald-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('waist')}
                    className="w-full p-5 flex items-center justify-between hover:bg-emerald-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Waist</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentWaistSizeInCm')?.toFixed(1) || '-'} cm</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.waist ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.waist && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.waist = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentWaistSizeInCm" unit="cm" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chest */}
              {filteredCheckins.some(c => c.currentChestSizeInCm) && (
                <div className="rounded-3xl bg-gradient-to-br from-cyan-50/60 to-cyan-100/30 backdrop-blur-xl border border-cyan-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('chest')}
                    className="w-full p-5 flex items-center justify-between hover:bg-cyan-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-cyan-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Chest</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentChestSizeInCm')?.toFixed(1) || '-'} cm</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.chest ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.chest && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.chest = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentChestSizeInCm" unit="cm" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hips */}
              {filteredCheckins.some(c => c.currentHipSizeInCm) && (
                <div className="rounded-3xl bg-gradient-to-br from-pink-50/60 to-pink-100/30 backdrop-blur-xl border border-pink-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('hips')}
                    className="w-full p-5 flex items-center justify-between hover:bg-pink-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-pink-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Hips</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentHipSizeInCm')?.toFixed(1) || '-'} cm</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.hips ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.hips && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.hips = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentHipSizeInCm" unit="cm" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Thigh */}
              {filteredCheckins.some(c => c.currentThighSizeInCm) && (
                <div className="rounded-3xl bg-gradient-to-br from-amber-50/60 to-amber-100/30 backdrop-blur-xl border border-amber-200/20 shadow-xl overflow-hidden">
                  <button
                    onClick={() => toggleMeasurement('thigh')}
                    className="w-full p-5 flex items-center justify-between hover:bg-amber-100/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <div className="text-left">
                        <h3 className="text-base font-semibold text-gray-900">Thigh</h3>
                        <p className="text-sm text-gray-600 mt-0.5">Latest: {getLatestMeasurement('currentThighSizeInCm')?.toFixed(1) || '-'} cm</p>
                      </div>
                    </div>
                    <ChevronRightIcon className={`w-5 h-5 text-gray-600 transition-transform ${expandedMeasurements.thigh ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedMeasurements.thigh && (
                    <div className="px-5 pb-5">
                      <div className="overflow-x-auto" ref={el => chartRefs.current.thigh = el}>
                        <ProgressChart data={filteredCheckins} measurement="currentThighSizeInCm" unit="cm" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-80 bg-white/50 backdrop-blur-md rounded-3xl border border-white/20">
            <div className="text-center">
              <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No progress data available</p>
              <p className="text-sm text-gray-500 mt-1">Start tracking your weight in the mobile app</p>
            </div>
          </div>
        )}

        {filteredCheckins.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Entries</h2>
            {/* Desktop table */}
            <div className="overflow-x-auto hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th 
                      onClick={() => handleSort('date')}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-purple-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Date
                        {sortBy === 'date' && (
                          sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('weight')}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase cursor-pointer hover:bg-purple-50/30 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Weight (kg)
                        {sortBy === 'weight' && (
                          sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fat %</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Waist (cm)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Chest (cm)</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((checkin, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-gray-100 hover:bg-purple-50/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {new Date(checkin.checkInDateTime).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {parseFloat(checkin.currentWeightInKg || 0).toFixed(1)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {checkin.currentFatPercentage ? `${parseFloat(checkin.currentFatPercentage).toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {checkin.currentWaistSizeInCm ? parseFloat(checkin.currentWaistSizeInCm).toFixed(1) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {checkin.currentChestSizeInCm ? parseFloat(checkin.currentChestSizeInCm).toFixed(1) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => openEditModal(checkin)}
                          className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {sortedEntries.map((checkin, idx) => (
                <div key={idx} className="rounded-2xl bg-gradient-to-br from-white/60 to-white/30 backdrop-blur-xl border border-white/20 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(checkin.checkInDateTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    <button
                      onClick={() => openEditModal(checkin)}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/50 border border-white/20 p-3">
                      <p className="text-xs text-gray-500">Weight</p>
                      <p className="text-sm font-semibold text-gray-900">{parseFloat(checkin.currentWeightInKg || 0).toFixed(1)} kg</p>
                    </div>
                    <div className="rounded-xl bg-white/50 border border-white/20 p-3">
                      <p className="text-xs text-gray-500">Fat</p>
                      <p className="text-sm font-semibold text-gray-900">{checkin.currentFatPercentage ? `${parseFloat(checkin.currentFatPercentage).toFixed(1)}%` : '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white/50 border border-white/20 p-3">
                      <p className="text-xs text-gray-500">Waist</p>
                      <p className="text-sm font-semibold text-gray-900">{checkin.currentWaistSizeInCm ? parseFloat(checkin.currentWaistSizeInCm).toFixed(1) : '-'} cm</p>
                    </div>
                    <div className="rounded-xl bg-white/50 border border-white/20 p-3">
                      <p className="text-xs text-gray-500">Chest</p>
                      <p className="text-sm font-semibold text-gray-900">{checkin.currentChestSizeInCm ? parseFloat(checkin.currentChestSizeInCm).toFixed(1) : '-'} cm</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <AddProgressModal
              isOpen={modalOpen}
              onClose={handleModalClose}
              userId={userData?.userId}
              checkin={selectedCheckin}
              onSuccess={handleModalSuccess}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default UserProgress
