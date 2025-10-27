import { useState, useEffect } from 'react'
import { 
  XMarkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { searchFoodItems, createMenu } from '../services/api'

const MenuCreationModal = ({ isOpen, onClose, userId }) => {
  const [menuName, setMenuName] = useState('')
  const [menuDescription, setMenuDescription] = useState('')
  const [menuDate, setMenuDate] = useState(new Date().toISOString().split('T')[0])
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedFoods, setSelectedFoods] = useState([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  // Search for food items
  const handleSearch = async () => {
    if (!searchText.trim() || !userId) return

    try {
      setSearching(true)
      setError(null)
      const results = await searchFoodItems(searchText, userId, false, 'RO')
      setSearchResults(results)
    } catch (err) {
      setError('Failed to search food items')
      console.error('Search error:', err)
    } finally {
      setSearching(false)
    }
  }

  // Add food to menu
  const addFoodToMenu = (food) => {
    const newFood = {
      ...food,
      quantity: 100, // Default quantity in grams
      unit: 'g'
    }
    setSelectedFoods([...selectedFoods, newFood])
    setSearchText('')
    setSearchResults([])
  }

  // Remove food from menu
  const removeFoodFromMenu = (index) => {
    setSelectedFoods(selectedFoods.filter((_, i) => i !== index))
  }

  // Update food quantity
  const updateFoodQuantity = (index, quantity) => {
    const updatedFoods = [...selectedFoods]
    updatedFoods[index].quantity = parseFloat(quantity) || 0
    setSelectedFoods(updatedFoods)
  }

  // Create menu
  const handleCreateMenu = async () => {
    if (!menuName.trim() || selectedFoods.length === 0) {
      setError('Please provide menu name and add at least one food item')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const menuData = {
        name: menuName,
        description: menuDescription,
        date: menuDate,
        userId: userId,
        foods: selectedFoods.map(food => ({
          foodId: food.id,
          foodName: food.name,
          quantity: food.quantity,
          unit: food.unit,
          calories: food.totalCalories,
          nutrients: food.totalNutrients
        }))
      }

      await createMenu(menuData)
      
      // Reset form
      setMenuName('')
      setMenuDescription('')
      setSelectedFoods([])
      setSearchText('')
      setSearchResults([])
      
      alert('Menu created successfully!')
      onClose()
    } catch (err) {
      setError('Failed to create menu')
      console.error('Create menu error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Calculate total calories
  const calculateTotalCalories = () => {
    return selectedFoods.reduce((total, food) => {
      const caloriesPer100g = food.totalCalories || 0
      const quantity = food.quantity || 0
      return total + (caloriesPer100g * quantity / 100)
    }, 0)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create Menu</h2>
            <p className="text-gray-600 mt-1">Add foods to create a daily menu</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Menu Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Menu Name *
              </label>
              <input
                type="text"
                value={menuName}
                onChange={(e) => setMenuName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Healthy Breakfast Menu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CalendarIcon className="w-4 h-4 inline mr-1" />
                Date
              </label>
              <input
                type="date"
                value={menuDate}
                onChange={(e) => setMenuDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={menuDescription}
              onChange={(e) => setMenuDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Optional description for the menu..."
            />
          </div>

          {/* Food Search */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Foods</h3>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Search for foods..."
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
              >
                <MagnifyingGlassIcon className="w-4 h-4 mr-1" />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-4 max-h-48 overflow-y-auto border border-gray-200 rounded-md">
                {searchResults.map((food, index) => (
                  <div key={index} className="p-3 border-b border-gray-100 hover:bg-gray-50 flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{food.name}</div>
                      <div className="text-sm text-gray-600">
                        {food.totalCalories} cal/100g • {food.category}
                      </div>
                      <div className="text-xs text-gray-500">
                        P: {food.totalNutrients?.proteinsInGrams || 0}g • 
                        C: {food.totalNutrients?.carbohydratesInGrams || 0}g • 
                        F: {food.totalNutrients?.fatInGrams || 0}g
                      </div>
                    </div>
                    <button
                      onClick={() => addFoodToMenu(food)}
                      className="bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 flex items-center"
                    >
                      <PlusIcon className="w-4 h-4 mr-1" />
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Foods */}
          {selectedFoods.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Selected Foods ({selectedFoods.length})
              </h3>
              <div className="space-y-3">
                {selectedFoods.map((food, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-lg flex justify-between items-center">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{food.name}</div>
                      <div className="text-sm text-gray-600">
                        {food.totalCalories} cal/100g • {food.category}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700">Quantity:</label>
                        <input
                          type="number"
                          value={food.quantity}
                          onChange={(e) => updateFoodQuantity(index, e.target.value)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                          min="1"
                          step="1"
                        />
                        <span className="text-sm text-gray-600">g</span>
                      </div>
                      <div className="text-sm text-blue-600 font-medium">
                        {Math.round((food.totalCalories * food.quantity) / 100)} cal
                      </div>
                      <button
                        onClick={() => removeFoodFromMenu(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Calories */}
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-900">Total Calories:</span>
                  <span className="text-xl font-bold text-blue-600">
                    {Math.round(calculateTotalCalories())} cal
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateMenu}
              disabled={loading || !menuName.trim() || selectedFoods.length === 0}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                'Create Menu'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MenuCreationModal
