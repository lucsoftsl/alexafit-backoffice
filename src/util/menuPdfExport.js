import { jsPDF } from 'jspdf'

import { calculateDisplayValues, safeNutrients } from './menuDisplay'

const MENU_MEAL_SECTIONS = [
  { id: 'breakfastPlan', labelKey: 'pages.myMenus.breakfast' },
  { id: 'lunchPlan', labelKey: 'pages.myMenus.lunch' },
  { id: 'dinnerPlan', labelKey: 'pages.myMenus.dinner' },
  { id: 'snackPlan', labelKey: 'pages.myMenus.snack' }
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

let fontLoadPromise = null
let titleFontLoadPromise = null
let titleFontBoldLoadPromise = null
let logoLoadPromise = null

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
          throw new Error(`Failed to load PDF bold title font: ${response.status}`)
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
  doc.addFont('Verdana-Bold.ttf', PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
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

const sanitizePdfText = value =>
  String(value || '')
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
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
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

    if (/^\d+[\.\)]?$/.test(entry)) {
      acc.push(`${entry} `)
      return acc
    }

    if (previous && /^\d+[\.\)]?\s*$/.test(previous)) {
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

const formatInstructionEntry = entry =>
  sanitizePdfText(entry).replace(/^\d+[\.\)]\s*/, '').trim()

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
  doc.setDrawColor(222, 226, 234)
  doc.setFillColor(...fill)
  doc.roundedRect(x, y, width, height, 12, 12, 'FD')
}

const isRecipeItem = item =>
  String(item?.type || '').toLowerCase() === 'recipe' ||
  Boolean(item?.recipeSteps || item?.ingredients)

const isLinkLikeLine = line =>
  /https?:\/\/|www\.|youtu\.be|youtube\.com|instagram\.com|facebook\.com|tiktok\.com/i.test(
    String(line || '')
  )

const sanitizeFilename = value =>
  String(value || 'menu-builder')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')

export const exportMenuBuilderToPdf = async ({ container, t }) => {
  const menus = (Array.isArray(container?.menus) ? container.menus : []).filter(
    menu =>
      MENU_MEAL_SECTIONS.some(
        section => Array.isArray(menu?.[section.id]) && menu[section.id].length > 0
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
  const marginX = 48
  const marginTop = 42
  const marginBottom = 42
  const usableWidth = pageWidth - marginX * 2
  const lineHeight = 13
  const summaryGap = 8
  const summaryWidth = (usableWidth - summaryGap * 4) / 5
  const summaryHeight = 78

  let y = marginTop
  let hasRenderedFirstMenuPage = false

  const ensureSpace = neededHeight => {
    if (y + neededHeight <= pageHeight - marginBottom) return
    doc.addPage()
    y = marginTop
  }

  const drawHeader = menu => {
    const innerX = marginX + 16
    const contentWidth = usableWidth - 32
    const brandTop = y
    const logoSize = 28
    const logoTextGap = 12
    const brandTextX = innerX + logoSize + logoTextGap

    const titleLines = doc.splitTextToSize(
      sanitizePdfText(
        container?.containerName || t('pages.myMenus.menuBuilder')
      ),
      contentWidth
    )
    const subtitleLines = doc.splitTextToSize(
      sanitizePdfText(menu?.parsedMenuName || menu?.name || t('pages.myMenus.menuName')),
      contentWidth
    )

    const titleY = brandTop + logoSize + 30
    const subtitleY = titleY + titleLines.length * 28
    const idY = subtitleY + subtitleLines.length * 18 + 14
    const dividerY = idY + 14
    const headerHeight = dividerY - (y - 14) + 8

    drawRoundedBlock(doc, marginX, y - 14, usableWidth, headerHeight, [255, 255, 255])

    doc.addImage(logoDataUrl, 'PNG', innerX, brandTop - 2, logoSize, logoSize)

    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text('AlexaFit', brandTextX, brandTop + 16)

    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(28)
    doc.text(titleLines, innerX, titleY)

    doc.setFont(PDF_TITLE_FONT_NAME, 'normal')
    doc.setFontSize(17)
    doc.setTextColor(71, 85, 105)
    doc.text(subtitleLines, innerX, subtitleY)

    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(`${t('pages.myMenus.id')}: ${menu?.id || '-'}`, innerX, idY)

    doc.setDrawColor(226, 232, 240)
    doc.line(innerX, dividerY, pageWidth - marginX - 16, dividerY)

    y = dividerY + 18
  }

  const drawSummaryCards = menuSummary => {
    const cards = [
      { title: t('pages.myMenus.totalMenu'), values: menuSummary.total },
      ...MENU_MEAL_SECTIONS.map(section => ({
        title: t(section.labelKey),
        values: menuSummary.perMeal[section.id]
      }))
    ]

    cards.forEach((card, index) => {
      const x = marginX + index * (summaryWidth + summaryGap)
      drawRoundedBlock(doc, x, y, summaryWidth, summaryHeight, [249, 250, 255])

      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(String(card.title).toUpperCase(), x + 10, y + 14)

      doc.setFont(PDF_FONT_NAME, 'bold')
      doc.setFontSize(17)
      doc.setTextColor(15, 23, 42)
      doc.text(`${Math.round(card.values.calories)} kcal`, x + 10, y + 38)

      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(71, 85, 105)
      const macroLines = doc.splitTextToSize(
        `P ${roundMacro(card.values.proteinsInGrams)}g · C ${roundMacro(card.values.carbohydratesInGrams)}g · F ${roundMacro(card.values.fatInGrams)}g`,
        summaryWidth - 20
      )
      doc.text(macroLines, x + 10, y + 56)
    })

    y += summaryHeight + 18
  }

  const estimateItemLayout = item => {
    const calculated = getItemCalculatedValues(item)
    const selectedAmount = getItemSelectedAmount(item)
    const selectedUnit = getItemDisplayUnit(item)
    const ingredients = Array.isArray(item?.ingredients) ? item.ingredients : []
    const ingredientNames = Array.isArray(item?.ingredientNames)
      ? item.ingredientNames.filter(Boolean)
      : []
    const instructions = normalizeInstructionEntries(item?.recipeSteps?.instructions)

    const ingredientText =
      ingredients.length > 0
        ? ingredients
            .map(ingredient => {
              const quantity = parseNumber(ingredient?.quantity)
              const quantityText =
                quantity > 0 ? `${quantity} ${ingredient?.unit || ''}`.trim() : ''
              return quantityText
                ? `${ingredient?.name || '-'} (${quantityText})`
                : ingredient?.name || '-'
            })
            .join(', ')
        : ingredientNames.length > 0
        ? ingredientNames.join(', ')
        : ''

    const textWidth = usableWidth - 32
    const nameLines = doc.splitTextToSize(
      sanitizePdfText(item?.name || t('pages.myMenus.unnamedItem')),
      textWidth
    )
    const metaLines = doc.splitTextToSize(
      `${isRecipeItem(item) ? t('pages.myMenus.recipeType') : t('pages.myMenus.foodType')} · ${selectedAmount} ${selectedUnit}`,
      textWidth
    )
    const macroLines = doc.splitTextToSize(
      `${t('pages.myMenus.calories')}: ${Math.round(calculated.calories)} kcal · P ${roundMacro(calculated.nutrients.proteinsInGrams)}g · C ${roundMacro(calculated.nutrients.carbohydratesInGrams)}g · F ${roundMacro(calculated.nutrients.fatInGrams)}g`,
      textWidth
    )
    const ingredientLines = ingredientText
      ? doc.splitTextToSize(
          `${t('pages.recipes.ingredients')}: ${sanitizePdfText(ingredientText)}`,
          textWidth
        )
      : []
    const instructionLines = instructions.flatMap(line =>
      doc.splitTextToSize(`- ${formatInstructionEntry(line)}`, textWidth)
    )

    const height =
      16 +
      nameLines.length * lineHeight +
      metaLines.length * lineHeight +
      macroLines.length * lineHeight +
      (ingredientLines.length ? 10 + ingredientLines.length * lineHeight : 0) +
      (instructionLines.length ? 10 + instructionLines.length * lineHeight : 0) +
      12

    return {
      nameLines,
      metaLines,
      macroLines,
      ingredientLines,
      instructionLines,
      height
    }
  }

  const drawItem = item => {
    const layout = estimateItemLayout(item)
    ensureSpace(layout.height)
    drawRoundedBlock(doc, marginX, y, usableWidth, layout.height, [248, 250, 252])

    let cursorY = y + 18

    doc.setFont(PDF_TITLE_FONT_NAME, PDF_TITLE_FONT_BOLD_STYLE)
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(layout.nameLines, marginX + 16, cursorY)
    cursorY += layout.nameLines.length * lineHeight + 2

    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(100, 116, 139)
    doc.text(layout.metaLines, marginX + 16, cursorY)
    cursorY += layout.metaLines.length * lineHeight + 2

    doc.setTextColor(51, 65, 85)
    doc.text(layout.macroLines, marginX + 16, cursorY)
    cursorY += layout.macroLines.length * lineHeight

    if (layout.ingredientLines.length) {
      cursorY += 10
      doc.text(layout.ingredientLines, marginX + 16, cursorY)
      cursorY += layout.ingredientLines.length * lineHeight
    }

    if (layout.instructionLines.length) {
      cursorY += 10
      layout.instructionLines.forEach(line => {
        doc.setTextColor(...(isLinkLikeLine(line) ? [37, 99, 235] : [71, 85, 105]))
        doc.text(line, marginX + 16, cursorY)
        cursorY += lineHeight
      })
    }

    y += layout.height + 10
  }

  const drawMealSection = (section, items) => {
    const firstItemHeight = items.length ? estimateItemLayout(items[0]).height : 44
    ensureSpace(30 + firstItemHeight)

    doc.setFillColor(255, 247, 237)
    doc.roundedRect(marginX, y - 6, usableWidth, 24, 10, 10, 'F')
    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42)
    doc.text(t(section.labelKey), marginX + 12, y + 10)

    doc.setFont(PDF_FONT_NAME, 'bold')
    doc.setFontSize(10)
    doc.setTextColor(249, 115, 22)
    doc.text(String(items.length), pageWidth - marginX - 12, y + 10, {
      align: 'right'
    })

    y += 28

    if (!items.length) {
      drawRoundedBlock(doc, marginX, y, usableWidth, 38, [248, 250, 252])
      doc.setFont(PDF_FONT_NAME, 'normal')
      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(t('pages.myMenus.noItems'), marginX + 16, y + 24)
      y += 50
      return
    }

    items.forEach(drawItem)
    y += 6
  }

  menus.forEach(menu => {
    if (hasRenderedFirstMenuPage) {
      doc.addPage()
      y = marginTop
    }
    hasRenderedFirstMenuPage = true

    const menuSummary = getTemplateNutritionSummary(menu)
    drawHeader(menu)
    drawSummaryCards(menuSummary)

    MENU_MEAL_SECTIONS.forEach(section => {
      drawMealSection(section, Array.isArray(menu?.[section.id]) ? menu[section.id] : [])
    })
  })

  const totalPages = doc.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(226, 232, 240)
    doc.line(marginX, pageHeight - marginBottom + 6, pageWidth - marginX, pageHeight - marginBottom + 6)
    doc.setFont(PDF_FONT_NAME, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `${sanitizePdfText(container?.containerName || t('pages.myMenus.menuBuilder'))} · ${page}/${totalPages}`,
      pageWidth - marginX,
      pageHeight - marginBottom + 22,
      { align: 'right' }
    )
  }

  doc.save(`${sanitizeFilename(container?.containerName || 'menu-builder')}.pdf`)
}
