const readFileAsDataUrl = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })

const loadImage = src =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load image'))
    image.src = src
  })

const getScaledDimensions = (width, height, maxWidth, maxHeight) => {
  if (!width || !height) {
    return { width: maxWidth, height: maxHeight }
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

export async function resizeImageFile(
  file,
  { maxWidth = 300, maxHeight = 400, quality = 0.85 } = {}
) {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) {
    return file
  }

  const sourceDataUrl = await readFileAsDataUrl(file)
  const image = await loadImage(sourceDataUrl)
  const { width, height } = getScaledDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height,
    maxWidth,
    maxHeight
  )

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    return file
  }

  context.drawImage(image, 0, 0, width, height)

  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, mimeType, mimeType === 'image/png' ? undefined : quality)
  )

  if (!blob) {
    return file
  }

  const nameWithoutExtension = file.name.replace(/\.[^.]+$/, '') || 'image'
  const extension = mimeType === 'image/png' ? 'png' : 'jpg'

  return new File([blob], `${nameWithoutExtension}.${extension}`, {
    type: mimeType,
    lastModified: Date.now()
  })
}

export async function getImagePreviewDataUrl(file) {
  return readFileAsDataUrl(file)
}
