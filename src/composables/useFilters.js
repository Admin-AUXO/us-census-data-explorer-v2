import { ref, computed, watch, nextTick } from 'vue'
import { useCensusStore } from '../stores/census'
import { getExecutiveMetricCatalog } from '../utils/executiveMetrics'

const GEO_COLUMNS = new Set([
  'state',
  'state_name',
  'state_fips',
  'state_abbr',
  'county',
  'county_name',
  'county_fips',
  'zcta5',
  'NAME',
  'land_area_sq_km',
  'water_area_sq_km',
  'census_region',
  'census_division',
  'urban_rural',
  'urban_area_name',
  'cbsa_code',
  'aiannh_name',
  'congressional_district',
  'cd116'
])

export const useFilters = () => {
  const store = useCensusStore()
  
  const selectedDataset = ref(store.currentDataset || '')
  const selectedYear = ref(store.currentYear || '')
  const selectedMetric = ref(store.currentMetric || '')
  const selectedCompareYear = ref(store.compareYear || '')
  const metricCatalog = computed(() => getExecutiveMetricCatalog(store.manifest))

  const selectedDatasetConfig = computed(() => {
    if (!store.manifest?.datasets || !selectedDataset.value) return null
    return store.manifest.datasets.find((dataset) => dataset.source_file === selectedDataset.value) || null
  })

  const availableYears = computed(() => {
    if (!store.data.state?.length) {
      if (store.currentDataset && !store.isLoading && import.meta.env.DEV) {
        console.warn('[Filters] No state data available to extract years')
      }
      return []
    }
    const firstRow = store.data.state[0]
    if (!firstRow || typeof firstRow !== 'object') {
      if (store.currentDataset && import.meta.env.DEV) {
        console.warn('[Filters] Cannot extract years: invalid first row')
      }
      return []
    }
    const columns = Object.keys(firstRow)
    if (!columns.length) {
      if (store.currentDataset && import.meta.env.DEV) {
        console.warn('[Filters] Cannot extract years: no columns found')
      }
      return []
    }
    const years = [...new Set(columns
      .map(col => col.match(/_(\d{4})$/)?.[1])
      .filter(Boolean)
    )].sort().reverse()
    if (years.length) return years

    if (store.currentDataset) {
      console.error('[Filters] No years found. Columns:', columns.slice(0, 10))
    }
    return (selectedDatasetConfig.value?.years_available || []).map(String).sort().reverse()
  })

  const availableMetrics = computed(() => {
    if (!store.data.state?.length || !selectedYear.value) return []
    const firstRow = store.data.state[0]
    if (!firstRow || typeof firstRow !== 'object') return []
    const rawColumns = Object.keys(firstRow)
    const columnsWithYear = rawColumns.filter(col => col.endsWith(`_${selectedYear.value}`))
    const columns = columnsWithYear.length
      ? columnsWithYear
      : rawColumns
        .filter((col) => !GEO_COLUMNS.has(col))
        .filter((col) => !/_\d{4}$/.test(col))
        .filter((col) => {
          const value = firstRow[col]
          return value !== null && value !== undefined && value !== '' && !Number.isNaN(Number.parseFloat(value))
        })
        .map((col) => `${col}_${selectedYear.value}`)
    const preferredOrder = [
      ...(selectedDatasetConfig.value?.display_columns || []),
      ...(store.manifest?.industry_configs?.general?.display_columns || [])
    ]
    const orderMap = new Map(preferredOrder.map((metric, index) => [metric, index]))

    return columns
      .map((col) => {
        const base = col.replace(/_(\d{4})$/, '')
        const meta = metricCatalog.value.get(base)
        return {
          value: col,
          base,
          label: meta?.label || base.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: meta?.category || 'other',
          order: orderMap.has(base) ? orderMap.get(base) : Number.MAX_SAFE_INTEGER
        }
      })
      .sort((left, right) => {
        if (left.order !== right.order) return left.order - right.order
        if (left.category !== right.category) return left.category.localeCompare(right.category)
        return left.label.localeCompare(right.label)
      })
  })

  const compareYears = computed(() => {
    if (!selectedMetric.value) return []
    const firstRow = store.data.state?.[0]
    const years = firstRow && typeof firstRow === 'object'
      ? [...new Set(Object.keys(firstRow)
        .map(col => col.match(/_(\d{4})$/)?.[1])
        .filter(Boolean)
      )].sort().reverse()
      : (selectedDatasetConfig.value?.years_available || []).map(String).sort().reverse()
    return years.filter(y => y !== selectedYear.value)
  })

  const onDatasetChange = async () => {
    if (!selectedDataset.value) {
      store.currentDataset = null
      store.currentYear = null
      store.currentMetric = null
      return
    }
    try {
      await store.loadDataset(selectedDataset.value)
      store.currentDataset = selectedDataset.value
      
      await nextTick()
      
      if (store.data.state?.length) {
        let retries = 0
        while (retries < 20 && !availableYears.value?.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
          await nextTick()
          retries++
        }
        
        if (availableYears.value?.length) {
          if (!selectedYear.value || !availableYears.value.includes(selectedYear.value)) {
            selectedYear.value = availableYears.value[0]
            await nextTick()
          }
          if (selectedYear.value) await onYearChange()
        } else {
          const errorMsg = `Year filter has no values. Dataset: ${selectedDataset.value}, Rows: ${store.data.state.length}`
          console.error(`[Filters] ${errorMsg}`)
          throw new Error(errorMsg)
        }
      } else {
        throw new Error(`Cannot extract years. Dataset: ${selectedDataset.value}, Reason: State data not loaded`)
      }
    } catch (error) {
      console.error('Failed to load dataset:', error)
      selectedDataset.value = ''
      store.currentDataset = null
      store.currentYear = null
      store.currentMetric = null
    }
  }

  const onYearChange = async () => {
    if (!selectedYear.value) return
    store.currentYear = selectedYear.value
    await nextTick()
    if (availableMetrics.value && availableMetrics.value.length > 0) {
      if (!selectedMetric.value || !availableMetrics.value.find(m => m.value === selectedMetric.value)) {
        selectedMetric.value = availableMetrics.value[0].value
      }
      onMetricChange()
    }
  }

const onMetricChange = () => {
    if (!selectedMetric.value) return
    store.currentMetric = selectedMetric.value
    if (!store.compareYear && compareYears.value.length > 0) {
      store.setAutoCompareYear()
    } else if (compareYears.value.length === 0) {
      store.compareYear = null
    }
    store.savePreferences()
  }

  const setMetricByBase = (baseMetric) => {
    if (!baseMetric) return
    const yearSuffix = selectedYear.value ? `_${selectedYear.value}` : ''
    const fullMetric = `${baseMetric}${yearSuffix}`
    const found = availableMetrics.value.find(m => m.value === fullMetric || m.base === baseMetric)
    if (found) {
      selectedMetric.value = found.value
      store.currentMetric = found.value
    }
  }

  const handleCompareYearChange = (event) => {
    const value = event.target?.value || event
    if (value === '') {
      store.setAutoCompareYear()
    } else {
      store.compareYear = value
    }
  }

  watch(() => store.currentDataset, (val) => {
    if (val && val !== selectedDataset.value) selectedDataset.value = val
  }, { immediate: true })

  watch(() => store.currentYear, (val) => {
    if (val && val !== selectedYear.value) selectedYear.value = val
  }, { immediate: true })

  watch(() => store.currentMetric, (val) => {
    if (val && val !== selectedMetric.value) selectedMetric.value = val
  }, { immediate: true })

  watch(() => store.compareYear, (val) => {
    selectedCompareYear.value = val || ''
  }, { immediate: true })

  watch(compareYears, (years) => {
    if (!years.length) {
      store.compareYear = null
      selectedCompareYear.value = ''
      return
    }
    if (store.compareYear && !years.includes(store.compareYear)) {
      store.compareYear = years[0]
      selectedCompareYear.value = years[0]
    }
  }, { immediate: true })

  watch(() => availableYears.value, async (years, oldYears) => {
    if (years?.length && selectedDataset.value && store.currentDataset === selectedDataset.value) {
      if (!selectedYear.value || !years.includes(selectedYear.value)) {
        selectedYear.value = years[0]
        await nextTick()
        if (selectedYear.value) await onYearChange()
      }
    } else if (selectedDataset.value && store.currentDataset === selectedDataset.value && !years?.length) {
      if (oldYears?.length) {
        console.warn(`[Filters] Years became empty for dataset ${selectedDataset.value}`)
      } else if (store.data.state?.length) {
        console.error(`[Filters] Year filter has no values. Rows: ${store.data.state.length}`)
      }
    }
  }, { immediate: true })

  watch(() => store.data.state, async (newData) => {
    if (newData?.length && selectedDataset.value && store.currentDataset === selectedDataset.value) {
      await nextTick()
      if (availableYears.value?.length && (!selectedYear.value || !availableYears.value.includes(selectedYear.value))) {
        selectedYear.value = availableYears.value[0]
        await nextTick()
        if (selectedYear.value) await onYearChange()
      }
    }
  }, { immediate: true, deep: true })

  return {
    selectedDataset,
    selectedYear,
    selectedMetric,
    selectedCompareYear,
    availableYears,
    availableMetrics,
    compareYears,
    onDatasetChange,
    onYearChange,
    onMetricChange,
    handleCompareYearChange,
    setMetricByBase
  }
}
