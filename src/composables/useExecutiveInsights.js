import { computed } from 'vue'
import { useCensusStore } from '../stores/census'
import { formatValue as formatMetricValue } from '../utils/formatUtils'
import { getExecutiveMetricCatalog } from '../utils/executiveMetrics'
import { getMetricValue, getStateName, getCountyName } from '../utils/censusAccessors'

const average = (values) => {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const percentile = (values, ratio) => {
  if (!values.length) return null
  const index = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)))
  return values[index]
}

const isFiniteMetricValue = (value) => Number.isFinite(value)

export const useExecutiveInsights = () => {
  const store = useCensusStore()

  const metricCatalog = computed(() => getExecutiveMetricCatalog(store.manifest))
  const selectedMetricBase = computed(() => store.currentMetric?.replace(/_\d{4}$/, '') || '')
  const selectedMetricMeta = computed(() => metricCatalog.value.get(selectedMetricBase.value) || null)

  const metricLabel = computed(() => {
    if (!selectedMetricBase.value) return ''
    return selectedMetricMeta.value?.label || selectedMetricBase.value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  })

  const filteredMetricValues = computed(() => {
    if (!store.currentMetric || !Array.isArray(store.filteredData)) return []
    return store.filteredData
      .map((row) => Number.parseFloat(getMetricValue(row, store.currentMetric)))
      .filter(isFiniteMetricValue)
  })

  const sortedMetricValues = computed(() => [...filteredMetricValues.value].sort((left, right) => left - right))

  const locationLabel = computed(() => {
    if (store.currentLevel === 'state') return 'States'
    if (store.currentLevel === 'county') return 'Counties'
    if (store.currentLevel === 'zcta5') return 'ZIP Codes'
    return 'Locations'
  })

  const topPerformers = computed(() => {
    if (!store.currentMetric || !Array.isArray(store.filteredData)) return []
    return store.filteredData
      .map((row) => ({
        name: store.currentLevel === 'state'
          ? getStateName(row)
          : store.currentLevel === 'county'
          ? getCountyName(row)
          : row.zcta5 || row.NAME || 'Unknown',
        value: Number.parseFloat(getMetricValue(row, store.currentMetric))
      }))
      .filter((item) => isFiniteMetricValue(item.value))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5)
  })

  const averageValue = computed(() => average(filteredMetricValues.value))
  const compareMetric = computed(() => {
    if (!store.currentMetric || !store.compareYear || !store.currentYear) return null
    return store.currentMetric.replace(`_${store.currentYear}`, `_${store.compareYear}`)
  })

  const yearOverYear = computed(() => {
    if (!compareMetric.value || !Array.isArray(store.filteredData)) return 0
    const currentValues = store.filteredData
      .map((row) => Number.parseFloat(getMetricValue(row, store.currentMetric)))
      .filter(isFiniteMetricValue)
    const compareValues = store.filteredData
      .map((row) => Number.parseFloat(getMetricValue(row, compareMetric.value)))
      .filter(isFiniteMetricValue)

    const currentAverage = average(currentValues)
    const previousAverage = average(compareValues)

    if (!currentAverage || !previousAverage) return 0
    return ((currentAverage - previousAverage) / previousAverage) * 100
  })

  const distribution = computed(() => {
    const values = sortedMetricValues.value
    return {
      min: values[0] ?? null,
      q1: percentile(values, 0.25),
      median: percentile(values, 0.5),
      q3: percentile(values, 0.75),
      max: values[values.length - 1] ?? null
    }
  })

  const executiveSignals = computed(() => {
    const values = filteredMetricValues.value
    if (!values.length) return []

    const topQuartile = percentile(sortedMetricValues.value, 0.75)
    const bottomQuartile = percentile(sortedMetricValues.value, 0.25)
    const averageMetric = averageValue.value
    const spread = distribution.value.max !== null && distribution.value.min !== null
      ? distribution.value.max - distribution.value.min
      : null

    return [
      {
        label: `Average ${metricLabel.value}`,
        value: averageMetric !== null ? formatMetricValue(averageMetric) : 'N/A',
        tone: 'neutral'
      },
      {
        label: 'Upper Quartile Threshold',
        value: topQuartile !== null ? formatMetricValue(topQuartile) : 'N/A',
        tone: 'positive'
      },
      {
        label: 'Lower Quartile Threshold',
        value: bottomQuartile !== null ? formatMetricValue(bottomQuartile) : 'N/A',
        tone: 'warning'
      },
      {
        label: 'Range Spread',
        value: spread !== null ? formatMetricValue(spread) : 'N/A',
        tone: 'neutral'
      }
    ]
  })

  return {
    metricLabel,
    locationLabel,
    averageValue,
    yearOverYear,
    distribution,
    executiveSignals,
    topPerformers
  }
}
