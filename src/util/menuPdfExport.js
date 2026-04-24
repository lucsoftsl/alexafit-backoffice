/* global Image, btoa, fetch */

import { jsPDF } from 'jspdf'

import { calculateDisplayValues, safeNutrients } from './menuDisplay'

const MENU_MEAL_SECTIONS = [
  {
    id: 'breakfastPlan',
    labelKey: 'pages.myMenus.breakfast',
    pdfLabel: 'Mic dejun'
  },
  { id: 'lunchPlan', labelKey: 'pages.myMenus.lunch', pdfLabel: 'Prânz' },
  { id: 'dinnerPlan', labelKey: 'pages.myMenus.dinner', pdfLabel: 'Cină' },
  { id: 'snackPlan', labelKey: 'pages.myMenus.snack', pdfLabel: 'Gustare' }
]

const PDF_FONT_NAME = 'ArialUnicodeSafe'
const PDF_FONT_STYLE = 'normal'
const PDF_TITLE_FONT_NAME = 'VerdanaPdf'
const PDF_TITLE_FONT_BOLD_STYLE = 'bold'
const FONT_ASSET_BASE_URL = `${import.meta.env.BASE_URL || '/'}assets/fonts`
const FONT_ASSET_URL = `${FONT_ASSET_BASE_URL}/Arial.ttf`
const TITLE_FONT_ASSET_URL = `${FONT_ASSET_BASE_URL}/Verdana.ttf`
const TITLE_FONT_BOLD_ASSET_URL = `${FONT_ASSET_BASE_URL}/Verdana-Bold.ttf`
const LOGO_ASSET_URL = `${import.meta.env.BASE_URL || '/'}assets/logo.png`

const STITCH_PDF_THEME = {
  page: [255, 255, 255],
  pageOrbPrimary: [255, 255, 255],
  pageOrbSecondary: [255, 255, 255],
  surface: [255, 255, 255],
  surfaceLow: [246, 238, 255],
  surfaceHigh: [228, 215, 255],
  primary: [83, 71, 200],
  primaryDim: [71, 58, 187],
  primaryFixed: [155, 148, 255],
  text: [51, 40, 79],
  textMuted: [97, 85, 127],
  textSoft: [124, 112, 156],
  inverseSurface: [18, 6, 45],
  inversePrimary: [137, 128, 255],
  accentWarm: [255, 241, 224],
  accentWarmText: [181, 91, 15],
  outlineGhost: [180, 166, 213]
}

let fontLoadPromise = null
let titleFontLoadPromise = null
let titleFontBoldLoadPromise = null
let logoLoadPromise = null
const pdfImageLoadCache = new Map()

const parseNumber = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const roundMacro = value =>
  Math.round((parseNumber(value) + Number.EPSILON) * 10) / 10

const arrayBufferToBase64 = buffer => {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

const arrayBufferToDataUrl = (buffer, mimeType) =>
  `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`

const stripControlChars = value =>
  Array.from(String(value || ''))
    .map(char => {
      const code = char.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : char
    })
    .join('')

const createRoundedImageDataUrl = (sourceUrl, size, radius) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Failed to create logo canvas context'))
        return
      }

      context.clearRect(0, 0, size, size)
      context.beginPath()
      context.moveTo(radius, 0)
      context.lineTo(size - radius, 0)
      context.quadraticCurveTo(size, 0, size, radius)
      context.lineTo(size, size - radius)
      context.quadraticCurveTo(size, size, size - radius, size)
      context.lineTo(radius, size)
      context.quadraticCurveTo(0, size, 0, size - radius)
      context.lineTo(0, radius)
      context.quadraticCurveTo(0, 0, radius, 0)
      context.closePath()
      context.clip()
      context.drawImage(image, 0, 0, size, size)

      resolve(canvas.toDataURL('image/png'))
    }
    image.onerror = () => reject(new Error('Failed to load PDF logo image'))
    image.src = sourceUrl
  })

const ensurePdfFont = async doc => {
  if (!fontLoadPromise) {
    fontLoadPromise = fetch(FONT_ASSET_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF font: ${response.status}`)
        }
        return response.arrayBuffer()
      })
      .then(arrayBufferToBase64)
  }

  const fontBase64 = await fontLoadPromise
  doc.addFileToVFS('Arial.ttf', fontBase64)
  doc.addFont('Arial.ttf', PDF_FONT_NAME, PDF_FONT_STYLE)
  doc.setFont(PDF_FONT_NAME, PDF_FONT_STYLE)
}

const ensurePdfTitleFonts = async doc => {
  if (!titleFontLoadPromise) {
    titleFontLoadPromise = fetch(TITLE_FONT_ASSET_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF title font: ${response.status}`)
        }
        return response.arrayBuffer()
      })
      .then(arrayBufferToBase64)
  }

  if (!titleFontBoldLoadPromise) {
    titleFontBoldLoadPromise = fetch(TITLE_FONT_BOLD_ASSET_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `Failed to load PDF bold title font: ${response.status}`
          )
        }
        return response.arrayBuffer()
      })
      .then(arrayBufferToBase64)
  }

  const [titleFontBase64, titleFontBoldBase64] = await Promise.all([
    titleFontLoadPromise,
    titleFontBoldLoadPromise
  ])

  doc.addFileToVFS('Verdana.ttf', titleFontBase64)
  doc.addFont('Verdana.ttf', PDF_TITLE_FONT_NAME, 'normal')
  doc.addFileToVFS('Verdana-Bold.ttf', titleFontBoldBase64)
  doc.addFont(
    'Verdana-Bold.ttf',
    PDF_TITLE_FONT_NAME,
    PDF_TITLE_FONT_BOLD_STYLE
  )
}

const ensurePdfLogo = async () => {
  if (!logoLoadPromise) {
    logoLoadPromise = fetch(LOGO_ASSET_URL)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load PDF logo: ${response.status}`)
        }
        return response.arrayBuffer()
      })
      .then(buffer => arrayBufferToDataUrl(buffer, 'image/png'))
      .then(dataUrl => createRoundedImageDataUrl(dataUrl, 96, 20))
  }

  return logoLoadPromise
}

const ensurePdfContentImage = async sourceUrl => {
  const normalized = String(sourceUrl || '').trim()
  if (!normalized) return null

  if (!pdfImageLoadCache.has(normalized)) {
    pdfImageLoadCache.set(
      normalized,
      fetch(normalized)
        .then(response => {
          if (!response.ok) {
            throw new Error(
              `Failed to load PDF content image: ${response.status}`
            )
          }
          return response.arrayBuffer()
        })
        .then(buffer => {
          const lower = normalized.toLowerCase()
          const mimeType = lower.includes('.png') ? 'image/png' : 'image/jpeg'
          return arrayBufferToDataUrl(buffer, mimeType)
        })
        .catch(() => null)
    )
  }

  return pdfImageLoadCache.get(normalized)
}

const sanitizePdfText = value =>
  stripControlChars(value)
    .normalize('NFC')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+\n/g, '\n')
    .trim()

const shouldAppendUrlFragment = (previous, current) => {
  const prev = String(previous || '').trim()
  const next = String(current || '').trim()
  if (!prev || !next) return false

  if (/https?:\/\/\S*$/i.test(prev)) return true

  if (
    /(www|youtube|instagram|facebook|tiktok|youtu\.be)$/i.test(prev) &&
    /^(com|ro|net|org|io|app|watch|@|\/|[a-z0-9_.-]+)/i.test(next)
  ) {
    return true
  }

  if (/^(com|ro|net|org|io|app)(\/|$)/i.test(next)) {
    return true
  }

  return false
}

const appendUrlFragment = (previous, current) => {
  const prev = String(previous || '').trim()
  const next = String(current || '').trim()

  if (!prev) return next
  if (!next) return prev

  if (/https?:\/\/www$/i.test(prev)) return `${prev}.${next}`

  if (
    /(youtube|instagram|facebook|tiktok|youtu\.be|www)$/i.test(prev) &&
    /^(com|ro|net|org|io|app)(\/|$)/i.test(next)
  ) {
    return `${prev}.${next}`
  }

  if (prev.endsWith('/') || next.startsWith('/')) {
    return `${prev}${next}`
  }

  return `${prev}${next}`
}

const normalizeInstructionEntries = entries => {
  const sanitized = (Array.isArray(entries) ? entries : [])
    .flatMap(entry => sanitizePdfText(entry).split('\n'))
    .map(entry => entry.trim())
    .filter(Boolean)
    .filter(entry => !/^(c\d*|c\s*c\d*|\?)$/i.test(entry))

  return sanitized.reduce((acc, entry) => {
    const previous = acc[acc.length - 1]

    if (/^\d+[.)]?$/.test(entry)) {
      acc.push(`${entry} `)
      return acc
    }

    if (previous && /^\d+[.)]?\s*$/.test(previous)) {
      acc[acc.length - 1] = `${previous}${entry}`.trim()
      return acc
    }

    if (previous && /^\?\s*$/.test(previous)) {
      acc[acc.length - 1] = entry
      return acc
    }

    if (previous && shouldAppendUrlFragment(previous, entry)) {
      acc[acc.length - 1] = appendUrlFragment(previous, entry)
      return acc
    }
    acc.push(entry)
    return acc
  }, [])
}

const parseJsonValue = value => {
  if (!value) return null
  if (typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return null
}

const getRecipeIngredients = item => {
  if (Array.isArray(item?.ingredients)) return item.ingredients
  const parsed = parseJsonValue(item?.ingredients)
  return Array.isArray(parsed) ? parsed : []
}

const getRecipeIngredientNames = item => {
  if (Array.isArray(item?.ingredientNames)) return item.ingredientNames
  const parsed = parseJsonValue(item?.ingredientNames)
  return Array.isArray(parsed) ? parsed : []
}

const getRecipeSteps = item => {
  if (item?.recipeSteps && typeof item.recipeSteps === 'object') {
    return item.recipeSteps
  }
  const parsed = parseJsonValue(item?.recipeSteps)
  return parsed && typeof parsed === 'object' ? parsed : {}
}

const formatInstructionEntry = entry =>
  sanitizePdfText(entry)
    .replace(/^\d+[.)]\s*/, '')
    .trim()

const getItemDisplayUnit = item => {
  const changedServingUnit =
    item?.changedServing?.unit || item?.changedServing?.servingOption?.unitName

  if (changedServingUnit) return changedServingUnit

  return item?.unit || (item?.isLiquid ? 'ml' : 'g')
}

const getItemSelectedAmount = item => {
  const changedQuantity = parseNumber(item?.changedServing?.quantity)
  if (changedQuantity > 0) return changedQuantity

  const changedValue = parseNumber(item?.changedServing?.value)
  if (changedValue > 0) return changedValue

  const quantity = parseNumber(item?.quantity)
  if (quantity > 0) return quantity

  const originalServingAmount = parseNumber(item?.originalServingAmount)
  if (originalServingAmount > 0) return originalServingAmount

  return 100
}

const formatRecipeConsumptionSummary = (item, t) => {
  const servingsCount = Math.max(
    1,
    parseNumber(item?.numberOfRecipeServings || item?.originalServings || 1)
  )
  const consumeQuantity =
    parseNumber(item?.changedServing?.quantity) ||
    parseNumber(item?.changedServing?.value)
  const consumeUnit =
    item?.changedServing?.servingOption?.unitName ||
    item?.changedServing?.unit ||
    (item?.isLiquid ? 'ml' : 'g')

  const parts = [`${t('pages.recipes.servings')}: ${servingsCount}`]

  if (consumeQuantity > 0) {
    parts.push(
      `${t('pages.myMenus.amount')}: ${consumeQuantity} ${consumeUnit}`
    )
  }

  return parts.join('  ·  ')
}

const getItemCalculatedValues = item => {
  const calculated = calculateDisplayValues(
    item,
    getItemSelectedAmount(item),
    parseNumber(item?.originalServingAmount) || 100,
    getItemDisplayUnit(item)
  )

  return {
    calories: parseNumber(calculated?.calories),
    nutrients: safeNutrients(calculated?.nutrients || {})
  }
}

const getTemplateMealTotals = items =>
  (items || []).reduce(
    (acc, item) => {
      const calculated = getItemCalculatedValues(item)
      return {
        calories: acc.calories + calculated.calories,
        proteinsInGrams:
          acc.proteinsInGrams +
          parseNumber(calculated.nutrients?.proteinsInGrams),
        carbohydratesInGrams:
          acc.carbohydratesInGrams +
          parseNumber(calculated.nutrients?.carbohydratesInGrams),
        fatInGrams:
          acc.fatInGrams + parseNumber(calculated.nutrients?.fatInGrams)
      }
    },
    {
      calories: 0,
      proteinsInGrams: 0,
      carbohydratesInGrams: 0,
      fatInGrams: 0
    }
  )

const getTemplateNutritionSummary = template => {
  const perMeal = MENU_MEAL_SECTIONS.reduce((acc, section) => {
    acc[section.id] = getTemplateMealTotals(template?.[section.id] || [])
    return acc
  }, {})

  return {
    total: Object.values(perMeal).reduce(
      (acc, mealTotals) => ({
        calories: acc.calories + parseNumber(mealTotals?.calories),
        proteinsInGrams:
          acc.proteinsInGrams + parseNumber(mealTotals?.proteinsInGrams),
        carbohydratesInGrams:
          acc.carbohydratesInGrams +
          parseNumber(mealTotals?.carbohydratesInGrams),
        fatInGrams: acc.fatInGrams + parseNumber(mealTotals?.fatInGrams)
      }),
      {
        calories: 0,
        proteinsInGrams: 0,
        carbohydratesInGrams: 0,
        fatInGrams: 0
      }
    ),
    perMeal
  }
}

const drawRoundedBlock = (doc, x, y, width, height, fill = [255, 255, 255]) => {
  doc.setDrawColor(...STITCH_PDF_THEME.outlineGhost)
  doc.setFillColor(...fill)
  doc.roundedRect(x, y, width, height, 12, 12, 'FD')
}

const drawPageBackground = (doc, pageWidth, pageHeight) => {
  doc.setFillColor(...STITCH_PDF_THEME.page)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')
}

const hasRecipeDetailContent = item =>
  getRecipeIngredients(item).length > 0 ||
  getRecipeIngredientNames(item).length > 0 ||
  normalizeInstructionEntries(getRecipeSteps(item)?.instructions).length > 0 ||
  Boolean(String(item?.photoUrl || '').trim())

const isRecipeItem = item =>
  String(item?.type || '').toLowerCase() === 'recipe' ||
  Boolean(
    item?.recipeSteps || item?.ingredients || hasRecipeDetailContent(item)
  )

const shouldShowRecipeDetailsInPdf = item =>
  isRecipeItem(item) ? item?.showRecipeDetailsInPdf === true : false
const isStructuredRecipeItem = item =>
  isRecipeItem(item) &&
  (item?.isStructuredMeal === true ||
    ((!Array.isArray(item?.servingOptions) ||
      item.servingOptions.length === 0) &&
      hasRecipeDetailContent(item)))
const shouldRenderDetailedRecipeBlock = item =>
  shouldShowRecipeDetailsInPdf(item) || isStructuredRecipeItem(item)

const sanitizeFilename = value =>
  String(value || 'menu-builder')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')

const escapeRegex = value =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const localizeGeneratedDayLabel = (value, t) => {
  const text = sanitizePdfText(value)
  const localizedDayLabel = String(t('pages.myMenus.dayLabel') || 'Day').trim()
  const candidateLabels = Array.from(
    new Set(
      [localizedDayLabel, 'Day', 'Ziua', 'Día', 'Dia', 'Jour']
        .map(label => String(label || '').trim())
        .filter(Boolean)
    )
  )

  for (const label of candidateLabels) {
    const match = text.match(
      new RegExp(`^${escapeRegex(label)}\\s+(\\d+)$`, 'i')
    )
    if (match) {
      return `${t('pages.myMenus.dayLabel')} ${match[1]}`
    }
  }

  return text
}

const MEAL_SECTION_STYLES = {
  breakfastPlan: {
    fill: [251, 228, 237],
    text: [167, 86, 119]
  },
  lunchPlan: {
    fill: [241, 223, 255],
    text: [138, 99, 178]
  },
  snackPlan: {
    fill: [252, 236, 180],
    text: [154, 121, 21]
  },
  dinnerPlan: {
    fill: [219, 243, 225],
    text: [91, 142, 101]
  }
}

const getMealSectionStyle = sectionId =>
  MEAL_SECTION_STYLES[sectionId] || {
    fill: STITCH_PDF_THEME.surfaceHigh,
    text: STITCH_PDF_THEME.primaryDim
  }

export const exportMenuBuilderToPdf = async ({ container, t }) => {
  const menus = (Array.isArray(container?.menus) ? container.menus : []).filter(
    menu =>
      MENU_MEAL_SECTIONS.some(
        section =>
          Array.isArray(menu?.[section.id]) && menu[section.id].length > 0
      )
  )
  if (!menus.length) return

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    compress: true
  })

  await ensurePdfFont(doc)
  await ensurePdfTitleFonts(doc)
  const logoDataUrl = await ensurePdfLogo()

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginTop = 32
  const marginBottom = 42
  const contentWidth = 430
  const contentX = (pageWidth - contentWidth) / 2
  const footerY = pageHeight - marginBottom + 22

  let y = marginTop
  let hasRenderedFirstMenuPage = false
  drawPageBackground(doc, pageWidth, pageHeight)

  const ensureSpace = neededHeight => {
    if (y + neededHeight <= pageHeight - marginBottom) return
    doc.addPage()
    drawPageBackground(doc, pageWidth, pageHeight)
    y = marginTop
  }

  const drawHeader = menu => {
    const menuSubtitle = sanitizePdfText(
      localizeGeneratedDayLabel(
        menu?.parsedMenuName || menu?.name || t('pages.myMenus.menuName'),
        t
      )
    )

    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(201, 189, 184)
    doc.text('ALEXAFIT MENU', contentX, y + 6)

    doc.addImage(
      logoDataUrl,
      'PNG',
      contentX + contentWidth - 28,
      y - 4,
      18,
      18
    )

    // Day label — full-width background strip, large bold text
    const dayBgY = y + 18
    const dayBgH = 52
    doc.setFillColor(...STITCH_PDF_THEME.surfaceHigh)
    doc.roundedRect(contentX, dayBgY, contentWidth, dayBgH, 16, 16, 'F')
    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(32)
    doc.setTextColor(...STITCH_PDF_THEME.primaryDim)
    doc.text(menuSubtitle, contentX + 20, dayBgY + 35)

    y += 88
  }

  const drawSummaryCards = menuSummary => {
    const summaryHeight = 54
    drawRoundedBlock(
      doc,
      contentX,
      y,
      contentWidth,
      summaryHeight,
      [248, 242, 243]
    )

    const metrics = [
      {
        label: 'TOTAL ZI',
        value: `${Math.round(menuSummary.total.calories)} kcal`
      },
      {
        label: 'PROTEINE',
        value: `${Math.round(menuSummary.total.proteinsInGrams)}g`
      },
      {
        label: 'CARBOHIDRAȚI',
        value: `${Math.round(menuSummary.total.carbohydratesInGrams)}g`
      },
      {
        label: 'GRĂSIMI',
        value: `${Math.round(menuSummary.total.fatInGrams)}g`
      }
    ]
    const metricWidth = contentWidth / metrics.length

    metrics.forEach((metric, index) => {
      const x = contentX + index * metricWidth
      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(6)
      doc.setTextColor(169, 154, 154)
      doc.text(metric.label, x + 12, y + 16)

      doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
      doc.setFontSize(index === 0 ? 16 : 14)
      doc.setTextColor(88, 79, 96)
      doc.text(metric.value, x + 12, y + 38)
    })

    y += summaryHeight + 18
  }

  const estimateSimpleItemLayout = item => {
    const calculated = getItemCalculatedValues(item)
    const selectedAmount = getItemSelectedAmount(item)
    const selectedUnit = getItemDisplayUnit(item)
    const titleWidth = contentWidth - 140
    const nameLines = doc.splitTextToSize(
      sanitizePdfText(item?.name || t('pages.myMenus.unnamedItem')),
      titleWidth
    )
    const caloriesText = `${selectedAmount}${selectedUnit ? ` ${selectedUnit} ${Math.round(parseNumber(calculated?.calories))} kcal` : ''}`
    return {
      nameLines,
      caloriesText,
      height: Math.max(18, nameLines.length * 12 + 2)
    }
  }

  const estimateRecipeLayout = item => {
    const ingredients = getRecipeIngredients(item)
    const ingredientNames = getRecipeIngredientNames(item).filter(Boolean)
    const instructions = normalizeInstructionEntries(
      getRecipeSteps(item)?.instructions
    )
    const ingredientEntries =
      ingredients.length > 0
        ? ingredients
            .map(ingredient => {
              const quantity = parseNumber(ingredient?.quantity)
              const quantityText =
                quantity > 0
                  ? `${quantity} ${ingredient?.unit || ''}`.trim()
                  : ''
              return quantityText
                ? `${ingredient?.name || '-'} (${quantityText})`
                : ingredient?.name || '-'
            })
            .filter(Boolean)
        : ingredientNames.length > 0
          ? ingredientNames
          : []
    const hasPhoto = Boolean(item?.photoUrl)
    const servingsCount = Math.max(
      1,
      parseNumber(item?.numberOfRecipeServings || item?.originalServings || 1)
    )
    const nameLines = doc.splitTextToSize(
      sanitizePdfText(item?.name || t('pages.myMenus.unnamedItem')),
      contentWidth - 28
    )
    const columnGap = 18
    const columnWidth = (contentWidth - 28 - columnGap) / 2
    const ingredientsWidth = Math.max(120, columnWidth - 4)
    const instructionsWidth = Math.max(120, columnWidth - 4)
    const ingredientLines = ingredientEntries.flatMap(entry =>
      doc.splitTextToSize(`- ${sanitizePdfText(entry)}`, ingredientsWidth)
    )
    const instructionText = instructions
      .map(formatInstructionEntry)
      .filter(Boolean)
      .join(' ')
    const instructionLines = instructionText
      ? doc.splitTextToSize(instructionText, instructionsWidth)
      : []
    const titleHeight = nameLines.length * 16
    const detailMetaHeight = 16
    const photoHeight = hasPhoto ? 156 : 0
    const columnHeight =
      26 + Math.max(ingredientLines.length * 9, instructionLines.length * 9, 18)
    const height =
      18 +
      titleHeight +
      detailMetaHeight +
      (hasPhoto ? photoHeight + 14 : 10) +
      columnHeight +
      18

    return {
      hasPhoto,
      servingsCount,
      nameLines,
      ingredientLines,
      instructionLines,
      columnGap,
      columnWidth,
      photoHeight,
      height,
      photoUrl: item?.photoUrl || null
    }
  }

  const estimateStructuredRecipeLayout = item => {
    const ingredients = getRecipeIngredients(item)
    const ingredientNames = getRecipeIngredientNames(item).filter(Boolean)
    const instructions = normalizeInstructionEntries(
      getRecipeSteps(item)?.instructions
    )
    const ingredientEntries =
      ingredients.length > 0
        ? ingredients
            .map(ingredient => {
              const quantity = parseNumber(ingredient?.quantity)
              const quantityText =
                quantity > 0
                  ? `${quantity} ${ingredient?.unit || ''}`.trim()
                  : ''
              return quantityText
                ? `${ingredient?.name || '-'} (${quantityText})`
                : ingredient?.name || '-'
            })
            .filter(Boolean)
        : ingredientNames

    const calculated = getItemCalculatedValues(item)
    const hasPhoto = Boolean(item?.photoUrl)
    const consumptionSummary = formatRecipeConsumptionSummary(item, t)

    // 2-column layout below the title:
    //   left (ingredients box): 62%  →  267pt
    //   gap: 16pt
    //   right (image): 38%  →  147pt
    const IMG_W = 147
    const COL_GAP = 16
    const BOX_W = contentWidth - IMG_W - COL_GAP // 267pt — ingredients container width
    const BOX_PAD = 12 // horizontal padding inside the box
    const BOX_INNER_W = BOX_W - BOX_PAD * 2 // 243pt — text width inside the box
    const IMG_H = IMG_W // square crop

    // Title spans full content width (no image beside it)
    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(14)
    const rawNameLines = doc.splitTextToSize(
      sanitizePdfText(item?.name || t('pages.myMenus.unnamedItem')),
      contentWidth - 4
    )
    const nameLines =
      rawNameLines.length > 2
        ? [rawNameLines[0], `${rawNameLines[1].slice(0, -1)}\u2026`]
        : rawNameLines

    // Ingredients measured against the box inner width
    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(10)
    const ingredientLineData = ingredientEntries.map(entry =>
      doc.splitTextToSize(`- ${sanitizePdfText(entry)}`, BOX_INNER_W)
    )
    const ingredientsHeight = ingredientLineData.reduce(
      (acc, lines) => acc + Math.max(13, lines.length * 11 + 4),
      0
    )

    // Instructions measured against full width
    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(9)
    const consumptionSummaryLines = consumptionSummary
      ? doc.splitTextToSize(consumptionSummary, contentWidth - 4)
      : []
    const instructionStepLines = instructions
      .map(formatInstructionEntry)
      .filter(Boolean)
      .map((entry, index) =>
        doc.splitTextToSize(`${index + 1}.  ${entry}`, contentWidth - 40)
      )

    // ── Height accounting (must mirror draw coordinates exactly) ──
    //
    // Title section (full-width):
    //   titleY = startY + 11  (14pt baseline offset)
    //   macroY = titleY + N×16 + 8
    //   containerTopY = macroY + 12 (macro h) + 12 (gap) = startY + N×16 + 43
    //
    // Container section (2-col):
    //   ingredientsBoxH = 12 (pad) + 10 (label) + 6 (gap) + ingH + 14 (pad-bottom) = 42 + ingH
    //   imageH = IMG_H (when photo)
    //   containerSectionH = max(ingredientsBoxH, hasPhoto ? IMG_H : 0)

    const titleSectionH =
      11 +
      nameLines.length * 16 +
      8 +
      12 +
      (consumptionSummaryLines.length
        ? consumptionSummaryLines.length * 10 + 8
        : 0) +
      12
    const ingredientsBoxH = 42 + ingredientsHeight
    const containerSectionH = Math.max(ingredientsBoxH, hasPhoto ? IMG_H : 0)
    const topBlockHeight = titleSectionH + containerSectionH

    // label(22) + step rows + padding-bottom(18)
    const instructionsBlockHeight = instructionStepLines.length
      ? 22 +
        instructionStepLines.reduce(
          (acc, lines) => acc + Math.max(17, lines.length * 11 + 5),
          0
        ) +
        18
      : 0

    return {
      calculated,
      hasPhoto,
      photoUrl: item?.photoUrl || null,
      nameLines,
      consumptionSummaryLines,
      ingredientLineData,
      instructionStepLines,
      boxWidth: BOX_W,
      boxPad: BOX_PAD,
      imageWidth: IMG_W,
      imageGap: COL_GAP,
      imageHeight: IMG_H,
      ingredientsBoxH,
      topBlockHeight,
      instructionsBlockHeight,
      height:
        topBlockHeight +
        (instructionsBlockHeight ? 20 + instructionsBlockHeight : 0) +
        14
    }
  }

  const drawSimpleItem = item => {
    const layout = estimateSimpleItemLayout(item)
    ensureSpace(layout.height + 4)

    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(108, 96, 110)
    doc.text(layout.nameLines, contentX + 4, y + 10)

    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(148, 128, 123)
    doc.text(layout.caloriesText, contentX + contentWidth - 2, y + 10, {
      align: 'right'
    })

    doc.setDrawColor(238, 228, 225)
    doc.line(
      contentX,
      y + layout.height,
      contentX + contentWidth,
      y + layout.height
    )
    y += layout.height + 6
  }

  const drawRecipeItem = async item => {
    const layout = estimateRecipeLayout(item)
    ensureSpace(layout.height + 8)

    drawRoundedBlock(
      doc,
      contentX,
      y,
      contentWidth,
      layout.height,
      [247, 240, 238]
    )
    const titleY = y + 28
    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(18)
    doc.setTextColor(71, 64, 66)
    doc.text(layout.nameLines, contentX + 14, titleY)

    const metaY = titleY + layout.nameLines.length * 16 + 8
    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(142, 121, 103)
    doc.text(
      `${layout.servingsCount} ${t('pages.recipes.servings')}`,
      contentX + 14,
      metaY
    )

    let currentY = metaY + 12

    if (layout.hasPhoto) {
      const imageDataUrl = await ensurePdfContentImage(layout.photoUrl)
      const imageWidth = contentWidth - 28
      const imageHeight = layout.photoHeight
      const imageX = contentX + 14
      const imageY = currentY + 6
      if (imageDataUrl) {
        doc.addImage(
          imageDataUrl,
          'JPEG',
          imageX,
          imageY,
          imageWidth,
          imageHeight
        )
      } else {
        doc.setFillColor(...STITCH_PDF_THEME.surfaceHigh)
        doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 16, 16, 'F')
      }
      currentY = imageY + imageHeight + 18
    }

    const leftColumnX = contentX + 14
    const rightColumnX = leftColumnX + layout.columnWidth + layout.columnGap

    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(178, 145, 165)
    doc.text(
      t('pages.recipes.ingredients').toUpperCase(),
      leftColumnX,
      currentY
    )
    doc.text(
      t('pages.myMenus.instructions').toUpperCase(),
      rightColumnX,
      currentY
    )

    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(6.7)
    doc.setTextColor(115, 103, 108)
    if (layout.ingredientLines.length) {
      doc.text(layout.ingredientLines, leftColumnX, currentY + 13)
    }
    if (layout.instructionLines.length) {
      doc.text(layout.instructionLines, rightColumnX, currentY + 13)
    }

    y += layout.height + 10
  }

  const drawStructuredRecipeItem = async item => {
    const layout = estimateStructuredRecipeLayout(item)
    ensureSpace(layout.height + 8)

    const startY = y
    const leftX = contentX

    // ── TITLE — full width, 14pt Verdana Bold ──
    // titleY = startY + 11  (14pt font baseline offset)
    const titleY = startY + 11
    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(14)
    doc.setTextColor(...STITCH_PDF_THEME.text)
    doc.text(layout.nameLines, leftX, titleY)

    // ── MACROS — single set, full width, under title ──
    // macroY = titleY + N×16 + 8
    const macroY = titleY + layout.nameLines.length * 16 + 8
    const macroText = `${Math.round(layout.calculated.calories)} kcal  ·  P ${roundMacro(layout.calculated.nutrients.proteinsInGrams)}g  ·  C ${roundMacro(layout.calculated.nutrients.carbohydratesInGrams)}g  ·  F ${roundMacro(layout.calculated.nutrients.fatInGrams)}g`
    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...STITCH_PDF_THEME.textMuted)
    doc.text(macroText, leftX, macroY)

    let containerTopY = macroY + 24

    if (layout.consumptionSummaryLines.length) {
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...STITCH_PDF_THEME.textSoft)
      doc.text(layout.consumptionSummaryLines, leftX, macroY + 14)
      containerTopY += layout.consumptionSummaryLines.length * 10 + 8
    }

    // ── LEFT COLUMN: ingredients box ──
    // Light container: very subtle purple-grey background, border-radius 8
    doc.setFillColor(247, 245, 252)
    doc.roundedRect(
      leftX,
      containerTopY,
      layout.boxWidth,
      layout.ingredientsBoxH,
      8,
      8,
      'F'
    )

    // INGREDIENTS section label
    // ingLabelBaseline = containerTopY + 12 (pad) + 8 (7pt baseline offset) = containerTopY + 20
    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...STITCH_PDF_THEME.textSoft)
    doc.text('INGREDIENTS', leftX + layout.boxPad, containerTopY + 20)

    // Ingredient rows
    // ingY = containerTopY + 20 (label baseline) + 10 (label h) + 6 (gap) = containerTopY + 36
    let ingY = containerTopY + 36
    for (const lines of layout.ingredientLineData) {
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(10)
      doc.setTextColor(...STITCH_PDF_THEME.text)
      doc.text(lines, leftX + layout.boxPad, ingY)
      ingY += Math.max(13, lines.length * 11 + 4)
    }

    // ── RIGHT COLUMN: image aligned with ingredients box top ──
    if (layout.hasPhoto) {
      const imgX = contentX + layout.boxWidth + layout.imageGap
      const imageDataUrl = await ensurePdfContentImage(layout.photoUrl)
      doc.setFillColor(...STITCH_PDF_THEME.surfaceHigh)
      doc.roundedRect(
        imgX,
        containerTopY,
        layout.imageWidth,
        layout.imageHeight,
        8,
        8,
        'F'
      )
      if (imageDataUrl) {
        doc.addImage(
          imageDataUrl,
          'JPEG',
          imgX,
          containerTopY,
          layout.imageWidth,
          layout.imageHeight
        )
      }
    }

    // Advance past the full top block
    y = startY + layout.topBlockHeight

    // ── INSTRUCTIONS — full width, light background, numbered steps ──
    if (layout.instructionStepLines.length) {
      y += 20

      // Lighter, less saturated background than surfaceLow
      drawRoundedBlock(
        doc,
        contentX,
        y,
        contentWidth,
        layout.instructionsBlockHeight,
        [248, 246, 252]
      )

      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(7)
      doc.setTextColor(...STITCH_PDF_THEME.textSoft)
      doc.text('INSTRUCTIONS', contentX + 16, y + 14)

      // Steps start at y + 26; each step gets generous line spacing
      let stepY = y + 26
      for (const lines of layout.instructionStepLines) {
        doc.setFont(PDF_FONT_NAME, 'normal')
        doc.setFontSize(9)
        doc.setTextColor(...STITCH_PDF_THEME.text)
        doc.text(lines, contentX + 16, stepY)
        stepY += Math.max(17, lines.length * 11 + 5)
      }

      y += layout.instructionsBlockHeight
    }

    y += 14
  }

  const drawMealSection = async (section, items) => {
    const style = getMealSectionStyle(section.id)
    const hasItems = items.length > 0
    const structuredRecipeItems = items.filter(isStructuredRecipeItem)
    const regularItems = items.filter(item => !isStructuredRecipeItem(item))
    const detailedRecipes = items.filter(
      item =>
        shouldRenderDetailedRecipeBlock(item) && !isStructuredRecipeItem(item)
    )
    const firstSectionContentHeight = !hasItems
      ? 34
      : structuredRecipeItems.length > 0
        ? estimateStructuredRecipeLayout(structuredRecipeItems[0]).height + 8
        : regularItems.length > 0
          ? estimateSimpleItemLayout(regularItems[0]).height + 6
          : detailedRecipes.length > 0
            ? estimateRecipeLayout(detailedRecipes[0]).height + 10
            : 34
    const sectionIntroHeight = 32 + firstSectionContentHeight
    ensureSpace(sectionIntroHeight)

    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(12)
    const sectionLabel = section.pdfLabel.toUpperCase()
    const sectionChipWidth = Math.max(96, doc.getTextWidth(sectionLabel) + 32)
    doc.setFillColor(...style.fill)
    doc.roundedRect(contentX, y, sectionChipWidth, 26, 13, 13, 'F')
    doc.setTextColor(...style.text)
    doc.text(sectionLabel, contentX + 16, y + 18)

    y += 32

    if (!hasItems) {
      drawRoundedBlock(doc, contentX, y, contentWidth, 34, [255, 252, 252])
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(144, 131, 138)
      doc.text(t('pages.myMenus.noItems'), contentX + 14, y + 20)
      y += 42
      return
    }

    for (const item of structuredRecipeItems) {
      await drawStructuredRecipeItem({
        ...item,
        mealSectionId: section.id
      })
    }

    for (const item of regularItems) {
      drawSimpleItem(item)
    }

    if (detailedRecipes.length > 0) {
      y += 6

      for (const item of detailedRecipes) {
        await drawRecipeItem(item)
      }
    }

    y += 10
  }

  menus.forEach
  const drawMenu = async menu => {
    const menuSummary = getTemplateNutritionSummary(menu)
    drawHeader(menu)
    drawSummaryCards(menuSummary)

    for (const section of MENU_MEAL_SECTIONS) {
      await drawMealSection(
        section,
        Array.isArray(menu?.[section.id]) ? menu[section.id] : []
      )
    }
  }

  for (const menu of menus) {
    if (hasRenderedFirstMenuPage) {
      doc.addPage()
      drawPageBackground(doc, pageWidth, pageHeight)
      y = marginTop
    }
    hasRenderedFirstMenuPage = true
    await drawMenu(menu)
  }

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(236, 227, 225)
    doc.line(
      contentX,
      pageHeight - marginBottom + 6,
      contentX + contentWidth,
      pageHeight - marginBottom + 6
    )
    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(171, 160, 159)
    doc.text(
      `${sanitizePdfText(container?.containerName || t('pages.myMenus.menuBuilder'))} · ${page}/${totalPages}`,
      contentX + contentWidth,
      footerY,
      { align: 'right' }
    )
  }

  doc.save(
    `${sanitizeFilename(container?.containerName || 'menu-builder')}.pdf`
  )
}
