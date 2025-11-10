/* eslint-disable no-undef */
// API service for fetching program subscribers
const API_BASE_URL = 'https://foodsync-api.vercel.app/backoffice'
// const API_BASE_URL = 'https://5938c8537ed3.ngrok-free.app/backoffice'
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
    email:
      loginDetails?.providerData?.[0]?.email ||
      loginDetails?.email ||
      subscriber.email ||
      'N/A',
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

export const getRecipesByCountryCode = async ({ countryCode, page = 0 }) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/getRecipesByCountryCode?countryCode=${encodeURIComponent(countryCode)}&page=${page}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${API_AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data?.data || { items: [] }
  } catch (error) {
    console.error('Error getting recipes by country code:', error)
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
  name,
  isAssignableByUser
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
        name,
        isAssignableByUser
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
  name,
  isAssignableByUser
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
        name,
        isAssignableByUser
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
  replaceExisting = true
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
    console.error('Error getting users:', error)
    throw error
  }
}

export const getUserMessages = async ({ userId }) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/messages/getUserMessages?userId=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${API_AUTH}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data.data?.data || []
  } catch (error) {
    console.error('Error getting user messages:', error)
    throw error
  }
}

export const sendMessageToUser = async ({ userId, message }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/messages/sendMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, message })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error sending user message:', error)
    throw error
  }
}

export const sendPushNotificationToUser = async ({
  pushNotificationToken,
  notificationTitle,
  notificationBody
}) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/notifications/sendPushNotification`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${API_AUTH}`,
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
    console.error('Error sending push notification to user:', error)
    throw error
  }
}

export const updateMessage = async ({ messageId, message }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/messages/updateMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messageId, message })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error updating message:', error)
    throw error
  }
}

export const deleteMessage = async ({ messageId }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/messages/deleteMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messageId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting message:', error)
    throw error
  }
}

export async function saveImageToImgb(image) {
  const formData = new FormData()
  if (typeof image === 'string') {
    if (image.includes('data:image')) {
      // Convert data URL to blob
      const response = await fetch(image)
      const blob = await response.blob()
      formData.append('image', blob, 'image.jpg')
    } else {
      formData.append('image', image)
    }
  } else if (image instanceof File) {
    formData.append('image', image)
  } else if (image?.uri) {
    // For React Native style image objects
    const response = await fetch(image.uri)
    const blob = await response.blob()
    const fileName = `image.${image.uri.split('.').pop() || 'jpg'}`
    formData.append('image', blob, fileName)
  } else {
    formData.append('image', image)
  }

  try {
    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    if (result?.data?.id) {
      return result.data
    } else {
      return null
    }
  } catch (error) {
    console.error('Error saving image to imgbb:', error)
    return null
  }
}

export const addItem = async itemData => {
  try {
    const response = await fetch(`${API_BASE_URL}/addItem`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(itemData)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding item:', error)
    throw error
  }
}

export const updateItem = async ({ userId, itemId, data, itemType }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/updateItem`, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId, itemId, data, itemType })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const responseData = await response.json()
    return responseData
  } catch (error) {
    console.error('Error updating item:', error)
    throw error
  }
}

export const deleteItem = async ({ itemId, itemType, userId }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deleteItem`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId, itemType, userId })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error deleting item:', error)
    throw error
  }
}

export const addPhotoToItem = async ({
  itemId,
  itemType,
  userId,
  photoUrl
}) => {
  try {
    const response = await fetch(`${API_BASE_URL}/addPhotoToItem`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${API_AUTH}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ itemId, itemType, userId, photoUrl })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error adding photo to item:', error)
    throw error
  }
}
