const parseJsonContent = (content, fallback) => {
  if (typeof content !== 'string') {
    return content ?? fallback
  }

  try {
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}

const asArray = (value) => {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string') {
    return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
  }

  return value ? [value] : []
}

export { parseJsonContent, asArray }
