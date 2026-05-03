import { defineStore } from 'pinia'
import { ref, computed, reactive, watch, watchEffect } from 'vue'
import { getDataPath } from '../utils/dataLoader'
import { createFilterSet, checkFilterMatch, parseNumericFilter, checkNumericRange, searchInFields } from '../utils/filterUtils'
import { parseCSV } from '../utils/csvParser'
import { getStateName as getRowStateName, getCountyName as getRowCountyName } from '../utils/censusAccessors'
import { enrichRowsWithExecutiveMetrics, normalizeCensusRows } from '../utils/executiveMetrics'
import { getCompactDatasetDefaultYear, inferDatasetYear, inflateCompactRows } from '../utils/compactData'

const detectDatasetDefaultYear = (rows, fallback = '2024') => {
  const firstRow = rows?.[0]
  if (!firstRow || typeof firstRow !== 'object') return fallback
  const years = Object.keys(firstRow)
    .map((key) => key.match(/_(\d{4})$/)?.[1])
    .filter(Boolean)
    .sort()
  return years.at(-1) || fallback
}

const fetchCompactDataset = async (baseName, level) => {
  const filePath = getDataPath(`data/${baseName}_${level}.json`)
  const response = await fetch(filePath)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(`Failed to load compact dataset ${filePath}: ${response.status} ${response.statusText}`)
  }

  const payload = await response.json()
  const defaultYear = getCompactDatasetDefaultYear(payload, inferDatasetYear(baseName))
  return {
    defaultYear,
    rows: inflateCompactRows(payload)
  }
}

export const useCensusStore = defineStore('census', () => {
  const currentLevel = ref('state')
  const currentState = ref(null)
  const currentCounty = ref(null)
  const currentDataset = ref(null)
  const currentYear = ref(null)
  const currentMetric = ref(null)
  const compareYear = ref(null)

  const data = ref({
    state: null,
    county: null,
    zcta5: null
  })

  const dataCache = ref(new Map())
  const loadPromises = new Map()
  const levelLoadingState = ref({
    state: false,
    county: false,
    zcta5: false
  })
  let activeLoads = 0
  const sortColumn = ref(null)
  const sortDirection = ref('asc')
  const isLoading = ref(false)
  const isLevelTransitioning = ref(false)
  const isFiltering = ref(false)
  const navigationDirection = ref('forward')
  const manifest = ref(null)
  const searchQuery = ref('')
  const loadingProgress = ref({ loaded: 0, total: 0, percentage: 0, stage: '' })
  const error = ref(null)
  const errorMessage = ref('')
  
  const dimensionFilters = reactive({
    selectedStates: [],
    selectedRegions: [],
    selectedDivisions: [],
    selectedCongressionalDistricts: [],
    selectedAiannh: [],
    selectedUrbanRural: [],
    selectedMetroAreas: [],
    areaMin: null,
    areaMax: null,
    metricValueMin: null,
    metricValueMax: null,
    populationMin: null,
    populationMax: null,
    incomeMin: null,
    incomeMax: null,
    ageMin: null,
    ageMax: null,
    densityMin: null,
    densityMax: null,
    vacancyMin: null,
    vacancyMax: null,
    yieldMin: null,
    affordabilityMin: null,
    pressureMax: null,
    executivePreset: ''
  })
  
  const filtersExpanded = ref(false)

  const breadcrumb = computed(() => {
    if (currentLevel.value === 'zcta5') {
      return `${currentCounty.value}, ${currentState.value}`
    } else if (currentLevel.value === 'county') {
      return currentState.value
    }
    return 'United States'
  })

  const hasError = computed(() => error.value !== null)
  const hasData = computed(() => data.value.state !== null && data.value.state.length > 0)
  const isEmpty = computed(() => {
    const filtered = filteredData.value
    return filtered === null || filtered === undefined || (Array.isArray(filtered) && filtered.length === 0)
  })

  const setError = (err, context = '') => {
    const message = err instanceof Error ? err.message : String(err)
    error.value = err
    errorMessage.value = context ? `${context}: ${message}` : message
    console.error(`[Census Store] Error${context ? ` (${context})` : ''}:`, err)
  }

  const clearError = () => {
    error.value = null
    errorMessage.value = ''
  }

  const levelDataCache = computed(() => {
    switch (currentLevel.value) {
      case 'state':
        return data.value.state
      case 'county':
        if (!data.value.county) return null
        if (!currentState.value) return null
        return data.value.county.filter(d => getRowStateName(d) === currentState.value)
      case 'zcta5':
        if (!data.value.zcta5 || !currentState.value || !currentCounty.value) return null
        return data.value.zcta5.filter(d =>
          getRowStateName(d) === currentState.value && getRowCountyName(d) === currentCounty.value
        )
      default:
        return null
    }
  })

  const filterCache = ref(new Map())
  const lastFilterKey = ref('')
  const currentFilterKey = ref('')

  const applyFilters = (dataset, filters, query, level, metric) => {
    if (!dataset || !Array.isArray(dataset) || dataset.length === 0) return null
    if (!hasActiveFilters.value) return dataset

    const areaMin = parseNumericFilter(filters.areaMin)
    const areaMax = parseNumericFilter(filters.areaMax)
    const metricMin = metric ? parseNumericFilter(filters.metricValueMin) : null
    const metricMax = metric ? parseNumericFilter(filters.metricValueMax) : null
    const populationMin = parseNumericFilter(filters.populationMin)
    const populationMax = parseNumericFilter(filters.populationMax)
    const incomeMin = parseNumericFilter(filters.incomeMin)
    const incomeMax = parseNumericFilter(filters.incomeMax)
    const ageMin = parseNumericFilter(filters.ageMin)
    const ageMax = parseNumericFilter(filters.ageMax)
    const densityMin = parseNumericFilter(filters.densityMin)
    const densityMax = parseNumericFilter(filters.densityMax)
    const vacancyMin = parseNumericFilter(filters.vacancyMin)
    const vacancyMax = parseNumericFilter(filters.vacancyMax)
    const yieldMin = parseNumericFilter(filters.yieldMin)
    const affordabilityMin = parseNumericFilter(filters.affordabilityMin)
    const pressureMax = parseNumericFilter(filters.pressureMax)
    const metricYear = metric?.match(/_(\d{4})$/)?.[1] || currentYear.value

    const selectedStatesSet = createFilterSet(filters.selectedStates)
    const selectedRegionsSet = createFilterSet(filters.selectedRegions)
    const selectedDivisionsSet = createFilterSet(filters.selectedDivisions)
    const selectedUrbanRuralSet = createFilterSet(filters.selectedUrbanRural)
    const selectedMetroAreasSet = createFilterSet(filters.selectedMetroAreas)
    const selectedAiannhSet = createFilterSet(filters.selectedAiannh)
    const selectedCongressionalDistrictsSet = createFilterSet(filters.selectedCongressionalDistricts)
    const rateBound = (bound, value) => (
      bound !== null && Math.abs(Number.parseFloat(value)) <= 1 && Math.abs(bound) > 1 ? bound / 100 : bound
    )

    return dataset.filter(d => {
      if (!d || typeof d !== 'object') return false

        if (level === 'state') {
        if (!checkFilterMatch(getRowStateName(d), selectedStatesSet)) return false
        if (selectedRegionsSet) {
          const regionName = getRegionName(d.census_region)
          if (!checkFilterMatch(regionName, selectedRegionsSet)) return false
        }
        if (selectedDivisionsSet) {
          const divisionName = getDivisionName(d.census_division)
          if (!checkFilterMatch(divisionName, selectedDivisionsSet)) return false
        }
      } else if (level === 'county') {
        if (selectedCongressionalDistrictsSet) {
          const cd = d.congressional_district || d.cd116 || ''
          if (cd && !checkFilterMatch(cd, selectedCongressionalDistrictsSet)) return false
        }
        if (selectedAiannhSet) {
          const aiannh = d.aiannh_name || 'N/A'
          if (aiannh !== 'N/A' && !checkFilterMatch(aiannh, selectedAiannhSet)) return false
        }
        if (selectedUrbanRuralSet) {
          const ur = d.urban_rural || 'N/A'
          if (!checkFilterMatch(ur, selectedUrbanRuralSet)) return false
        }
        if (selectedMetroAreasSet) {
          const metro = d.urban_area_name || (d.cbsa_code ? `CBSA: ${d.cbsa_code}` : null)
          if (metro && !checkFilterMatch(metro, selectedMetroAreasSet)) return false
        }
      } else if (level === 'zcta5') {
        if (selectedUrbanRuralSet) {
          const ur = d.urban_rural || 'N/A'
          if (!checkFilterMatch(ur, selectedUrbanRuralSet)) return false
        }
        if (selectedAiannhSet) {
          const aiannh = d.aiannh_name || 'N/A'
          if (aiannh !== 'N/A' && !checkFilterMatch(aiannh, selectedAiannhSet)) return false
        }
        if (selectedMetroAreasSet) {
          const metro = d.urban_area_name || (d.cbsa_code ? `CBSA: ${d.cbsa_code}` : null)
          if (metro && !checkFilterMatch(metro, selectedMetroAreasSet)) return false
        }
      }

      if (areaMin !== null || areaMax !== null) {
        if (!checkNumericRange(d.land_area_sq_km, areaMin, areaMax)) return false
      }

      if (metricMin !== null && metric) {
        if (!checkNumericRange(d[metric], metricMin, metricMax)) return false
      } else if (metricMax !== null && metric) {
        if (!checkNumericRange(d[metric], null, metricMax)) return false
      }

      if (populationMin !== null || populationMax !== null) {
        const population = d[`total_population_${metricYear}`] ?? d.total_population
        if (!checkNumericRange(population, populationMin, populationMax)) return false
      }

      if (incomeMin !== null || incomeMax !== null) {
        const income = d[`median_household_income_${metricYear}`] ?? d.median_household_income
        if (!checkNumericRange(income, incomeMin, incomeMax)) return false
      }

      if (ageMin !== null || ageMax !== null) {
        const age = d[`median_age_${metricYear}`] ?? d.median_age
        if (!checkNumericRange(age, ageMin, ageMax)) return false
      }

      if (densityMin !== null || densityMax !== null) {
        if (!checkNumericRange(d[`population_density_${metricYear}`] ?? d.population_density, densityMin, densityMax)) return false
      }

      if (vacancyMin !== null || vacancyMax !== null) {
        const vacancy = d[`housing_vacancy_rate_${metricYear}`] ?? d.housing_vacancy_rate
        if (!checkNumericRange(vacancy, rateBound(vacancyMin, vacancy), rateBound(vacancyMax, vacancy))) return false
      }

      if (yieldMin !== null) {
        if (!checkNumericRange(d[`gross_rental_yield_${metricYear}`] ?? d.gross_rental_yield, yieldMin, null)) return false
      }

      if (affordabilityMin !== null) {
        if (!checkNumericRange(d[`housing_affordability_index_${metricYear}`] ?? d.housing_affordability_index, affordabilityMin, null)) return false
      }

if (pressureMax !== null) {
        if (!checkNumericRange(d[`cost_pressure_index_${metricYear}`] ?? d.cost_pressure_index, null, pressureMax)) return false
      }

      if (query) {
        const searchableFields = level === 'state'
          ? [getRowStateName(d), d.state_abbr]
          : level === 'county'
          ? [getRowCountyName(d), getRowStateName(d), d.urban_area_name]
          : [d.zcta5, getRowCountyName(d), getRowStateName(d)]

        if (!searchInFields(d, query, searchableFields)) return false
      }

      return true
    })
  }

  const hasActiveFilters = computed(() => {
    const f = dimensionFilters
    return (
      f.selectedStates.length > 0 ||
      f.selectedRegions.length > 0 ||
      f.selectedDivisions.length > 0 ||
      f.selectedCongressionalDistricts.length > 0 ||
      f.selectedAiannh.length > 0 ||
      f.selectedUrbanRural.length > 0 ||
      f.selectedMetroAreas.length > 0 ||
      f.areaMin !== null ||
      f.areaMax !== null ||
      f.metricValueMin !== null ||
      f.metricValueMax !== null ||
      f.populationMin !== null ||
      f.populationMax !== null ||
      f.incomeMin !== null ||
      f.incomeMax !== null ||
      f.ageMin !== null ||
      f.ageMax !== null ||
      f.densityMin !== null ||
      f.densityMax !== null ||
      f.vacancyMin !== null ||
      f.vacancyMax !== null ||
      f.yieldMin !== null ||
      f.affordabilityMin !== null ||
      f.pressureMax !== null ||
      f.executivePreset !== '' ||
      searchQuery.value !== ''
    )
  })

  const filteredData = computed(() => {
    const dataset = levelDataCache.value
    if (!dataset) return null
    return applyFilters(
      dataset,
      dimensionFilters,
      searchQuery.value?.toLowerCase() || '',
      currentLevel.value,
      currentMetric.value
    )
  })

  watch(currentFilterKey, (key) => {
    if (key && filterCache.value.has(key)) {
      lastFilterKey.value = key
    }
  })

  watchEffect(() => {
    const level = currentLevel.value
    const filters = dimensionFilters
    const query = searchQuery.value?.toLowerCase() || ''
    const metric = currentMetric.value
    const dataset = levelDataCache.value

    if (!dataset || !hasActiveFilters.value) return

    const filterKey = `${level}_${JSON.stringify(filters)}_${query}_${metric}`
    currentFilterKey.value = filterKey

    if (!filterCache.value.has(filterKey)) {
      if (filterCache.value.size > 10) {
        filterCache.value.clear()
      }
      const result = applyFilters(dataset, filters, query, level, metric)
      filterCache.value.set(filterKey, result)
    }
  })

  const getRegionName = (code) => {
    const regions = {
      '1': 'Northeast',
      '2': 'Midwest',
      '3': 'South',
      '4': 'West'
    }
    return regions[code] || 'N/A'
  }
  
  const getDivisionName = (code) => {
    const divisions = {
      '1': 'New England',
      '2': 'Middle Atlantic',
      '3': 'East North Central',
      '4': 'West North Central',
      '5': 'South Atlantic',
      '6': 'East South Central',
      '7': 'West South Central',
      '8': 'Mountain',
      '9': 'Pacific'
    }
    return divisions[code] || 'N/A'
  }
  
  const availableYears = computed(() => {
    if (!data.value.state?.length) return []
    const firstRow = data.value.state[0]
    if (!firstRow || typeof firstRow !== 'object') return []
    return [...new Set(Object.keys(firstRow)
      .map(col => col.match(/_(\d{4})$/)?.[1])
      .filter(Boolean)
    )].sort().reverse()
  })
  
  const getPreviousYear = (currentYear) => {
    if (!currentYear) return null
    const yearNum = parseInt(currentYear)
    const prevYear = (yearNum - 1).toString()
    return availableYears.value.includes(prevYear) ? prevYear : null
  }


  const loadManifest = async () => {
    clearError()
    try {
      const manifestPath = getDataPath('data/manifest.json')
      if (import.meta.env.DEV) {
        console.log(`[Census Store] Loading manifest from: ${manifestPath}`)
      }
      const response = await fetch(manifestPath)
      if (!response.ok) {
        const errorMsg = `Failed to load manifest: ${response.status} ${response.statusText} from ${manifestPath}. Check if file exists at public/data/manifest.json`
        setError(new Error(errorMsg), 'Manifest')
        throw new Error(errorMsg)
      }
      const manifestData = await response.json()
      if (!manifestData?.datasets?.length) {
        const err = new Error(`Invalid manifest format: expected datasets array`)
        setError(err, 'Manifest')
        throw err
      }
      if (import.meta.env.DEV) {
        console.log(`[Census Store] Manifest loaded: ${manifestData.datasets.length} datasets`)
      }
      manifest.value = manifestData
      return manifest.value
    } catch (error) {
      if (!errorMessage.value) {
        setError(error, 'Manifest')
      }
      throw error
    }
  }

  const loadDatasetLevel = async (filename, level) => {
    const cacheKey = `${filename}_${level}`
    const levelNames = { state: 'States', county: 'Counties', zcta5: 'ZIP Codes' }

    if (dataCache.value.has(cacheKey)) {
      const cached = dataCache.value.get(cacheKey)
      data.value[level] = cached
      clearError()
      return cached
    }

    if (loadPromises.has(cacheKey)) {
      return loadPromises.get(cacheKey)
    }

    const loadPromise = (async () => {
      clearError()
      levelLoadingState.value[level] = true
      activeLoads++
      isLoading.value = true

      try {
        const baseName = filename.replace('.csv', '')
        loadingProgress.value = { loaded: 0, total: 0, percentage: 0, stage: '' }
        
        loadingProgress.value.stage = `Loading ${levelNames[level]}...`
        let levelData
        let datasetDefaultYear = inferDatasetYear(baseName)
        try {
          loadingProgress.value = { loaded: 1, total: 3, percentage: 33, stage: `Loading ${levelNames[level]}...` }
          const compactData = await fetchCompactDataset(baseName, level)
          if (compactData) {
            levelData = compactData.rows
            datasetDefaultYear = compactData.defaultYear || datasetDefaultYear
            loadingProgress.value = { loaded: 2, total: 3, percentage: 67, stage: `Loading ${levelNames[level]}...` }
          }
        } catch (compactError) {
          console.warn(`[Census Store] Compact dataset load failed for ${baseName}_${level}.json, falling back to CSV.`, compactError)
          levelData = null
        }

        if (!levelData) {
          const filePath = getDataPath(`data/${baseName}_${level}.csv`)
          if (import.meta.env.DEV) {
            console.log(`[Census Store] Loading ${level} CSV fallback from: ${filePath}`)
          }
          const response = await fetch(filePath)

          if (!response.ok) {
            const errorMsg = `Failed to load ${level} data: ${response.status} ${response.statusText} from ${filePath}. Expected file: public/data/${baseName}_${level}.json or public/data/${baseName}_${level}.csv`
            setError(new Error(errorMsg), `Load ${levelNames[level]}`)
            throw new Error(errorMsg)
          }

          const contentLength = response.headers.get('content-length')
          if (contentLength) {
            loadingProgress.value.total = parseInt(contentLength, 10)
          }

          const text = await response.text()
          if (!text || text.trim().length === 0) {
            const err = new Error(`Empty file received from ${filePath}`)
            setError(err, `Load ${levelNames[level]}`)
            throw err
          }

          try {
            levelData = await parseCSV(text, (progress) => {
              loadingProgress.value = { ...progress, stage: `Loading ${levelNames[level]}...` }
            })
          } catch (parseError) {
            console.error(`[Census Store] CSV parsing error for ${filePath}:`, parseError)
            const err = new Error(`Failed to parse CSV: ${parseError.message || parseError}`)
            setError(err, `Parse ${levelNames[level]}`)
            throw err
          }
        }

        if (!levelData || !Array.isArray(levelData)) {
          const errorMsg = `Invalid data format returned for ${baseName}_${level}. Expected array, got ${typeof levelData}`
          setError(new Error(errorMsg), `Invalid ${levelNames[level]} data`)
          console.error(`[Census Store] ${errorMsg}`, levelData)
          throw new Error(errorMsg)
        }

        if (levelData.length === 0) {
          const errorMsg = `No data rows found in ${baseName}_${level}. Data file may be empty.`
          setError(new Error(errorMsg), `Empty ${levelNames[level]} data`)
          console.error(`[Census Store] ${errorMsg}`)
          throw new Error(errorMsg)
        }

        datasetDefaultYear = detectDatasetDefaultYear(levelData, datasetDefaultYear)
        const normalizedData = normalizeCensusRows(levelData, level, datasetDefaultYear)
        const enrichedData = enrichRowsWithExecutiveMetrics(normalizedData)
        data.value[level] = enrichedData
        dataCache.value.set(cacheKey, enrichedData)
        filterCache.value.clear()
        currentFilterKey.value = ''
        lastFilterKey.value = ''
        
        if (import.meta.env.DEV) {
          console.log(`[Census Store] ${levelNames[level]} data loaded and cached: ${enrichedData.length} rows`)
        }

        loadingProgress.value = { loaded: enrichedData.length, total: enrichedData.length, percentage: 100, stage: '' }
        
        return enrichedData
      } catch (error) {
        if (!errorMessage.value) {
          setError(error, `Load ${levelNames[level]}`)
        }
        console.error(`Failed to load ${level} dataset:`, error)
        loadingProgress.value = { loaded: 0, total: 0, percentage: 0, stage: '' }
        throw error
      } finally {
        levelLoadingState.value[level] = false
        activeLoads = Math.max(0, activeLoads - 1)
        if (activeLoads === 0) {
          isLoading.value = false
        }
        loadPromises.delete(cacheKey)
        setTimeout(() => {
          loadingProgress.value = { loaded: 0, total: 0, percentage: 0, stage: '' }
        }, 500)
      }
    })()

    loadPromises.set(cacheKey, loadPromise)
    return loadPromise
  }

  const loadDataset = async (filename) => {
    const baseName = filename.replace('.csv', '')
    console.log(`[Census Store] Loading dataset: ${filename} (base: ${baseName})`)
    clearError()

    const cacheKeyState = `${baseName}_state`
    const cacheKeyCounty = `${baseName}_county`
    const cacheKeyZcta5 = `${baseName}_zcta5`

    const hasState = dataCache.value.has(cacheKeyState) && dataCache.value.get(cacheKeyState)?.length > 0
    const hasCounty = dataCache.value.has(cacheKeyCounty) && dataCache.value.get(cacheKeyCounty)?.length > 0
    const hasZcta5 = dataCache.value.has(cacheKeyZcta5) && dataCache.value.get(cacheKeyZcta5)?.length > 0

    data.value = { state: null, county: null, zcta5: null }

    if (hasState && hasCounty && hasZcta5) {
      data.value = {
        state: dataCache.value.get(cacheKeyState),
        county: dataCache.value.get(cacheKeyCounty),
        zcta5: dataCache.value.get(cacheKeyZcta5)
      }
      filterCache.value.clear()
      currentFilterKey.value = ''
      lastFilterKey.value = ''
      return data.value
    }

    if (hasState) data.value.state = dataCache.value.get(cacheKeyState)
    if (hasCounty) data.value.county = dataCache.value.get(cacheKeyCounty)
    if (hasZcta5) data.value.zcta5 = dataCache.value.get(cacheKeyZcta5)

    isLoading.value = true

    try {
      const requiredLoads = []

      if (!hasState) {
        requiredLoads.push(loadDatasetLevel(filename, 'state'))
      }

      if (!hasCounty) {
        requiredLoads.push(loadDatasetLevel(filename, 'county'))
      }
      
      if ((currentLevel.value === 'zcta5' || (currentState.value && currentCounty.value)) && !hasZcta5) {
        requiredLoads.push(loadDatasetLevel(filename, 'zcta5'))
      }

      if (requiredLoads.length) {
        await Promise.all(requiredLoads)
      }
      return data.value
    } catch (error) {
      console.error('Failed to load dataset:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const sortData = (dataset) => {
    if (!sortColumn.value || !dataset) return dataset
    return [...dataset].sort((a, b) => {
      const aVal = sortColumn.value === 'state_name'
        ? getRowStateName(a)
        : sortColumn.value === 'county_name'
        ? getRowCountyName(a)
        : a[sortColumn.value]
      const bVal = sortColumn.value === 'state_name'
        ? getRowStateName(b)
        : sortColumn.value === 'county_name'
        ? getRowCountyName(b)
        : b[sortColumn.value]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection.value === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal).toLowerCase()
      const bStr = String(bVal).toLowerCase()
      return sortDirection.value === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }

  const toggleSort = (column) => {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortColumn.value = column
      sortDirection.value = 'asc'
    }
  }

  const drillToState = async (stateName) => {
    navigationDirection.value = 'forward'
    isLevelTransitioning.value = true
    setTimeout(async () => {
      currentState.value = stateName
      currentCounty.value = null
      currentLevel.value = 'county'
      sortColumn.value = null
      sortDirection.value = 'asc'
      if (currentDataset.value && !data.value.county) {
        try {
          await loadDatasetLevel(currentDataset.value, 'county')
        } catch (error) {
          console.error('Failed to preload county data:', error)
        }
      }
      setTimeout(() => { isLevelTransitioning.value = false }, 300)
    }, 200)
  }

  const drillToCounty = async (countyName) => {
    navigationDirection.value = 'forward'
    isLevelTransitioning.value = true
    setTimeout(async () => {
      currentCounty.value = countyName
      currentLevel.value = 'zcta5'
      sortColumn.value = null
      sortDirection.value = 'asc'
      if (currentDataset.value && !data.value.zcta5) {
        try {
          await loadDatasetLevel(currentDataset.value, 'zcta5')
        } catch (error) {
          console.error('Failed to preload zcta5 data:', error)
        }
      }
      setTimeout(() => { isLevelTransitioning.value = false }, 300)
    }, 200)
  }

  const goBack = () => {
    navigationDirection.value = 'backward'
    isLevelTransitioning.value = true
    setTimeout(() => {
      if (currentLevel.value === 'zcta5') {
        currentCounty.value = null
        currentLevel.value = 'county'
      } else if (currentLevel.value === 'county') {
        currentState.value = null
        currentCounty.value = null
        currentLevel.value = 'state'
      }
      sortColumn.value = null
      sortDirection.value = 'asc'
      setTimeout(() => {
        resetFilters()
        isLevelTransitioning.value = false
      }, 100)
    }, 200)
  }

  const reset = () => {
    currentLevel.value = 'state'
    currentState.value = null
    currentCounty.value = null
    sortColumn.value = null
    sortDirection.value = 'asc'
    resetFilters()
  }

  const savePreferences = () => {
    try {
      const prefs = {
        dataset: currentDataset.value,
        year: currentYear.value,
        metric: currentMetric.value
      }
      localStorage.setItem('census_prefs', JSON.stringify(prefs))
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  }

  const loadPreferences = () => {
    try {
      const prefs = localStorage.getItem('census_prefs')
      if (prefs) {
        const parsed = JSON.parse(prefs)
        return parsed
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
    return null
  }

  const setAutoCompareYear = () => {
    if (currentYear.value) {
      const prevYear = getPreviousYear(currentYear.value)
      if (prevYear) {
        compareYear.value = prevYear
      } else {
        compareYear.value = null
      }
    }
  }
  
  const resetFilters = () => {
    const f = dimensionFilters
    if (currentLevel.value === 'state' && data.value.state?.length) {
      f.selectedStates = []
      f.selectedRegions = []
      f.selectedDivisions = []
    } else if (currentLevel.value === 'county' && data.value.county?.length) {
      const countyData = data.value.county.filter(d => getRowStateName(d) === currentState.value)
      f.selectedCongressionalDistricts = [...new Set(countyData.map(d => d.congressional_district || d.cd116 || '').filter(Boolean))]
      f.selectedAiannh = [...new Set(countyData.map(d => d.aiannh_name || 'N/A').filter(a => a && a !== 'N/A'))]
      f.selectedUrbanRural = [...new Set(countyData.map(d => d.urban_rural || 'N/A').filter(ur => ur && ur !== 'N/A'))]
      f.selectedMetroAreas = [...new Set(countyData.map(d => d.urban_area_name || (d.cbsa_code ? `CBSA: ${d.cbsa_code}` : null)).filter(Boolean))]
    } else if (currentLevel.value === 'zcta5' && data.value.zcta5?.length) {
      const zcta5Data = data.value.zcta5.filter(d => 
        getRowStateName(d) === currentState.value && getRowCountyName(d) === currentCounty.value
      )
      f.selectedAiannh = [...new Set(zcta5Data.map(d => d.aiannh_name || 'N/A').filter(a => a && a !== 'N/A'))]
      f.selectedUrbanRural = [...new Set(zcta5Data.map(d => d.urban_rural || 'N/A').filter(ur => ur && ur !== 'N/A'))]
      f.selectedMetroAreas = [...new Set(zcta5Data.map(d => d.urban_area_name || (d.cbsa_code ? `CBSA: ${d.cbsa_code}` : null)).filter(Boolean))]
    }
    f.areaMin = null
    f.areaMax = null
    f.metricValueMin = null
    f.metricValueMax = null
    f.populationMin = null
    f.populationMax = null
    f.incomeMin = null
    f.incomeMax = null
    f.ageMin = null
    f.ageMax = null
    f.densityMin = null
    f.densityMax = null
    f.vacancyMin = null
    f.vacancyMax = null
    f.yieldMin = null
    f.affordabilityMin = null
    f.pressureMax = null
    f.executivePreset = ''
  }

  let filterTimeout = null
  watch(() => [
    dimensionFilters.selectedStates,
    dimensionFilters.selectedRegions,
    dimensionFilters.selectedDivisions,
    dimensionFilters.selectedCongressionalDistricts,
    dimensionFilters.selectedAiannh,
    dimensionFilters.selectedUrbanRural,
    dimensionFilters.selectedMetroAreas,
    dimensionFilters.areaMin,
    dimensionFilters.areaMax,
    dimensionFilters.metricValueMin,
    dimensionFilters.metricValueMax,
    dimensionFilters.populationMin,
    dimensionFilters.populationMax,
    dimensionFilters.incomeMin,
    dimensionFilters.incomeMax,
    dimensionFilters.ageMin,
    dimensionFilters.ageMax,
    dimensionFilters.densityMin,
    dimensionFilters.densityMax,
    dimensionFilters.vacancyMin,
    dimensionFilters.vacancyMax,
    dimensionFilters.yieldMin,
    dimensionFilters.affordabilityMin,
    dimensionFilters.pressureMax,
    dimensionFilters.executivePreset,
    searchQuery.value,
    currentLevel.value,
    currentMetric.value
  ], () => {
    if (filterTimeout) clearTimeout(filterTimeout)
    isFiltering.value = true
    filterCache.value.clear()
    currentFilterKey.value = ''
    lastFilterKey.value = ''
    filterTimeout = setTimeout(() => {
      isFiltering.value = false
      filterTimeout = null
    }, 100)
  }, { deep: true })

  const preloadNextLevel = async () => {
    if (!currentDataset.value) return
    const level = currentLevel.value
    if (level === 'state' && !data.value.county && !levelLoadingState.value.county) {
      try {
        await loadDatasetLevel(currentDataset.value, 'county')
      } catch (error) {
        console.error('Failed to preload county data:', error)
      }
    } else if (level === 'county' && currentState.value && !data.value.zcta5 && !levelLoadingState.value.zcta5) {
      try {
        await loadDatasetLevel(currentDataset.value, 'zcta5')
      } catch (error) {
        console.error('Failed to preload zcta5 data:', error)
      }
    }
  }

  watch(() => currentLevel.value, async (newLevel) => {
    if (!currentDataset.value) return
    if (newLevel === 'county' && !data.value.county && !levelLoadingState.value.county) {
      try {
        await loadDatasetLevel(currentDataset.value, 'county')
      } catch (error) {
        console.error('Failed to load county data:', error)
      }
    } else if (newLevel === 'zcta5' && !data.value.zcta5 && !levelLoadingState.value.zcta5) {
      try {
        await loadDatasetLevel(currentDataset.value, 'zcta5')
      } catch (error) {
        console.error('Failed to load zcta5 data:', error)
      }
    }
  })

  watch(() => [currentState.value, currentLevel.value], async () => {
    if (currentLevel.value === 'state' && currentState.value) {
      setTimeout(() => preloadNextLevel(), 1000)
    }
  })

  watch(() => currentDataset.value, async (newDataset) => {
    if (!newDataset) return
    const needsInitialLoad = !data.value.state || (currentLevel.value !== 'state' && !data.value.county)
    if (needsInitialLoad) {
      await loadDataset(newDataset)
      return
    }

    if (currentLevel.value === 'zcta5' && !data.value.zcta5) {
      await loadDatasetLevel(newDataset, 'zcta5')
    }
  })

  return {
    currentLevel,
    currentState,
    currentCounty,
    currentDataset,
    currentYear,
    currentMetric,
    compareYear,
    data,
    dataCache,
    sortColumn,
    sortDirection,
    isLoading,
    isLevelTransitioning,
    isFiltering,
    navigationDirection,
    loadingProgress,
    levelLoadingState,
    manifest,
    searchQuery,
    dimensionFilters,
    filtersExpanded,
    error,
    errorMessage,
    breadcrumb,
    filteredData,
    hasActiveFilters,
    availableYears,
    hasError,
    hasData,
    isEmpty,
    clearError,
    getRegionName,
    getDivisionName,
    getPreviousYear,
    setAutoCompareYear,
    resetFilters,
    loadManifest,
    loadDataset,
    loadDatasetLevel,
    preloadNextLevel,
    sortData,
    toggleSort,
    drillToState,
    drillToCounty,
    goBack,
    reset,
    savePreferences,
    loadPreferences
  }
})
