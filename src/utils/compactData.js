const YEAR_RE = /(?:^|_)(\d{4})(?=_|$)/g

export const inferDatasetYear = (sourceName, fallback = '2024') => {
  const years = [...String(sourceName || '').matchAll(YEAR_RE)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)

  return years.length ? String(Math.max(...years)) : fallback
}

export const getCompactDatasetDefaultYear = (payload, fallback = '2024') => {
  if (payload?.year) return String(payload.year)
  if (Array.isArray(payload?.years) && payload.years.length) {
    return String(Math.max(...payload.years.map(Number).filter(Number.isFinite)))
  }
  if (payload?.source_file) return inferDatasetYear(payload.source_file, fallback)
  return fallback
}

export const inflateCompactRows = (payload) => {
  const columns = payload?.columns
  const rows = payload?.rows
  const dictionaries = payload?.dictionaries || {}

  if (!Array.isArray(columns) || !Array.isArray(rows) || columns.length === 0) {
    throw new Error('Invalid compact dataset payload')
  }

  return rows.map((values) => {
    if (!Array.isArray(values)) {
      throw new Error('Invalid compact dataset row')
    }

    return Object.fromEntries(columns.map((column, index) => {
      const value = values[index] ?? null
      const dictionary = dictionaries[column]
      return [column, Array.isArray(dictionary) && value !== null ? dictionary[value] ?? null : value]
    }))
  })
}
