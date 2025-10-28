/* eslint-disable no-undef */
// API service for fetching program subscribers
const API_BASE_URL = 'https://foodsync-api.vercel.app/backoffice'
const API_AUTH = 'c29aWGZHd0o6ZT54LXVUZi1GOGohaVFyVHFy'

export const fetchProgramSubscribers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/getProgramSubscribers`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching program subscribers:', error)
    throw error
  }
}

export const fetchUserDailyNutrition = async (userId, dateApplied) => {
  try {
    const response = await fetch(`${API_BASE_URL}/getUserDailyNutrition`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        dateApplied: dateApplied
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching user daily nutrition:', error)
    throw error
  }
}

export const formatSubscriptionStatus = subscriber => {
  // Check subscription whitelist details first
  if (subscriber.subscriptionWhitelistDetails?.isPro === 'true') {
    return {
      status: 'active',
      plan: 'Program Plan',
      expiresAt: subscriber.subscriptionWhitelistDetails?.activeUntil || 'N/A'
    }
  }

  // Check subscription details
  if (subscriber.subscriptionDetails?.Pro?.isActive) {
    return {
      status: 'active',
      plan: 'Pro Plan',
      expiresAt: subscriber.subscriptionDetails.Pro.expirationDate || 'N/A'
    }
  }

  return {
    status: 'inactive',
    plan: 'No Plan',
    expiresAt: 'N/A'
  }
}

export const formatUserData = subscriber => {
  const userData = subscriber.userData || {}
  const loginDetails = subscriber.loginDetails || {}

  // Try to get name from multiple sources
  let name = 'Unknown'
  if (userData.name) {
    name = userData.name
  } else if (subscriber.firstName && subscriber.lastName) {
    name = `${subscriber.firstName} ${subscriber.lastName}`.trim()
  } else if (loginDetails.displayName) {
    name = loginDetails.displayName
  } else if (subscriber.firstName) {
    name = subscriber.firstName
  } else if (subscriber.lastName) {
    name = subscriber.lastName
  }

  return {
    name: name,
    email: subscriber.email || 'N/A',
    phone: subscriber.phoneNumber || 'N/A',
    country: subscriber.country || 'N/A',
    gender: userData.selectedGender || 'N/A',
    age: userData.selectedBirthDate
      ? new Date().getFullYear() -
        new Date(userData.selectedBirthDate).getFullYear()
      : 'N/A',
    height: userData.selectedHeight ? `${userData.selectedHeight} cm` : 'N/A',
    weight: userData.selectedWeight ? `${userData.selectedWeight} kg` : 'N/A',
    goal: userData.selectedGoalType || 'N/A',
    activity: userData.selectedActivityType || 'N/A'
  }
}

export const formatPaymentData = subscriber => {
  const payment = subscriber.paymentDetails || {}
  return {
    status: payment.status || 'N/A',
    amount: payment.paymentSuccess ? 'Paid' : 'Not Paid',
    date: payment.paymentDate || 'N/A',
    country: payment.detectedCountry || 'N/A'
  }
}

export const sendPushNotification = async (
  pushNotificationToken,
  notificationTitle,
  notificationBody
) => {
  try {
    const response = await fetch(
      'https://foodsync-api.vercel.app/notifications/sendPushNotification',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pushNotificationToken,
          notificationTitle,
          notificationBody
        })
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending push notification:', error)
    throw error
  }
}

export const searchFoodItems = async ({
  searchText,
  userId,
  onlyRecipes = false,
  countryCode = null
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/elasticSearch`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        searchTerm: searchText,
        itemType: 'FOOD',
        onlyRecipes,
        countryCode: countryCode || 'RO'
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    console.error('Error searching food items:', error)
    throw error
  }
}

export const getItemsByIds = async ({ ids }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/getItemsByIds`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ids })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting items by ids:', error)
    throw error
  }
}

export const getUnapprovedItems = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/getUnapprovedItems`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return (
      data?.data || { foodItems: { items: [] }, exerciseItems: { items: [] } }
    )
  } catch (error) {
    console.error('Error getting unapproved items:', error)
    throw error
  }
}

export const setItemVerifiedStatus = async ({ itemId, verified, itemType }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/setItemVerifiedStatus`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemId,
        verified,
        itemType
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error setting item verified status:', error)
    throw error
  }
}

export const getAllMenuTemplates = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/getAllMenuTemplates`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting all menu templates:', error)
    throw error
  }
}

export const addMenuTemplate = async ({
  breakfastPlan,
  lunchPlan,
  dinnerPlan,
  snackPlan,
  name
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/addMenuTemplate`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        breakfastPlan,
        lunchPlan,
        dinnerPlan,
        snackPlan,
        name
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding menu template:', error)
    throw error
  }
}

export const updateMenuTemplate = async ({
  menuTemplateId,
  breakfastPlan,
  lunchPlan,
  dinnerPlan,
  snackPlan,
  name
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/updateMenuTemplate`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menuTemplateId,
        breakfastPlan,
        lunchPlan,
        dinnerPlan,
        snackPlan,
        name
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating menu template:', error)
    throw error
  }
}

export const deleteMenuTemplateById = async ({ menuTemplateId }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deleteMenuTemplateById`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menuTemplateId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting menu template by id:', error)
    throw error
  }
}

export const assignMenuTemplateToUser = async ({
  userId,
  menuTemplateId,
  dateApplied,
  replaceExisting = false
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/assignMenuTemplateToUser`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        menuTemplateId,
        dateApplied,
        replaceExisting
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error assigning menu template to user:', error)
    throw error
  }
}

export const removeMenuFromUser = async ({
  userId,
  dateApplied,
  menuTemplateId
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/removeMenuFromUser`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        dateApplied,
        menuTemplateId
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error removing menu from user:', error)
    throw error
  }
}

export const getUserMenus = async ({ userId }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/getUserMenus`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting user menus:', error)
    throw error
  }
}

export const deleteMenuTemplateItemById = async ({
  itemId,
  itemType,
  menuTemplateId
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deleteMenuTemplateItemById`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId, itemType, menuTemplateId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting menu template item by id:', error)
    throw error
  }
}

export const getUserByUserId = async ({ userId }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/getUserByUserId`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting user by user id:', error)
    throw error
  }
}

export const getUsers = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/getUsers`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error getting users:', error)
    throw error
  }
}
