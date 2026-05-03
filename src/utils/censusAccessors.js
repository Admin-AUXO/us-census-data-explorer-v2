export const getStateName = (row) => row?.state_name || row?.state || row?.NAME || 'Unknown'

export const getCountyName = (row) => row?.county_name || row?.county?.split(',')[0]?.trim() || row?.NAME || 'Unknown'

export const getPrimaryLocationName = (row, level) => {
  if (level === 'state') return getStateName(row)
  if (level === 'county') return getCountyName(row)
  return row?.zcta5 || row?.NAME || 'Unknown'
}

export const getMetricValue = (row, metric) => {
  if (!row || !metric) return null
  const direct = row[metric]
  if (direct !== undefined && direct !== null && direct !== '') return direct
  const baseMetric = metric.replace(/_\d{4}$/, '')
  return row[baseMetric]
}

export const hasValue = (value) => value !== undefined && value !== null && value !== ''
