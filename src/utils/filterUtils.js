export const createFilterSet = (items) => {
  return items && items.length > 0 ? new Set(items) : null
}

export const checkFilterMatch = (value, filterSet) => {
  return !filterSet || filterSet.has(value)
}

export const parseNumericFilter = (value) => {
  if (value == null || value === '') return null
  const parsed = parseFloat(value)
  return isNaN(parsed) ? null : parsed
}

export const checkNumericRange = (value, min, max) => {
  const numValue = parseFloat(value)
  if (!Number.isFinite(numValue) || numValue <= -999999) return false
  if (min !== null && numValue < min) return false
  if (max !== null && numValue > max) return false
  return true
}

export const searchInFields = (row, query, fields) => {
  if (!query) return true
  const lowerQuery = query.toLowerCase()
  return fields.some(field => {
    const value = Object.prototype.hasOwnProperty.call(row, field) ? row[field] : field
    return value && String(value).toLowerCase().includes(lowerQuery)
  })
}
