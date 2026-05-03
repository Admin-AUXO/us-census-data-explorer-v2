import { watch } from 'vue'
import { useCensusStore } from '../stores/census'

const URL_PARAM_KEYS = {
  level: 'level',
  state: 'state',
  county: 'county',
  dataset: 'dataset',
  year: 'year',
  metric: 'metric',
  compareYear: 'compareYear',
  search: 'search',
  filters: 'filters'
}

const REAL_ESTATE_DATASET = 'industry_realestate_2018_2024'
const VALID_LEVELS = new Set(['state', 'county'])

export function useUrlState() {
  const store = useCensusStore()

  const encodeFilters = (filters) => {
    const activeFilters = {}
    const f = filters

    if (f.selectedStates?.length) activeFilters.states = f.selectedStates
    if (f.selectedRegions?.length) activeFilters.regions = f.selectedRegions
    if (f.selectedDivisions?.length) activeFilters.divisions = f.selectedDivisions
    if (f.selectedCongressionalDistricts?.length) activeFilters.cd = f.selectedCongressionalDistricts
    if (f.selectedAiannh?.length) activeFilters.aiannh = f.selectedAiannh
    if (f.selectedUrbanRural?.length) activeFilters.ur = f.selectedUrbanRural
    if (f.selectedMetroAreas?.length) activeFilters.metro = f.selectedMetroAreas
    if (f.areaMin !== null) activeFilters.areaMin = f.areaMin
    if (f.areaMax !== null) activeFilters.areaMax = f.areaMax
    if (f.metricValueMin !== null) activeFilters.metricMin = f.metricValueMin
    if (f.metricValueMax !== null) activeFilters.metricMax = f.metricValueMax

    if (Object.keys(activeFilters).length === 0) return null
    return btoa(JSON.stringify(activeFilters))
  }

  const decodeFilters = (encoded) => {
    if (!encoded) return null
    try {
      const decoded = JSON.parse(atob(encoded))
      const filters = {
        selectedStates: decoded.states || [],
        selectedRegions: decoded.regions || [],
        selectedDivisions: decoded.divisions || [],
        selectedCongressionalDistricts: decoded.cd || [],
        selectedAiannh: decoded.aiannh || [],
        selectedUrbanRural: decoded.ur || [],
        selectedMetroAreas: decoded.metro || [],
        areaMin: decoded.areaMin ?? null,
        areaMax: decoded.areaMax ?? null,
        metricValueMin: decoded.metricMin ?? null,
        metricValueMax: decoded.metricMax ?? null
      }
      return filters
    } catch {
      return null
    }
  }

  const updateUrl = () => {
    const query = {}

    if (store.currentLevel && store.currentLevel !== 'state') {
      query[URL_PARAM_KEYS.level] = store.currentLevel
    }
    if (store.currentState) {
      query[URL_PARAM_KEYS.state] = store.currentState
    }
    if (store.currentCounty) {
      query[URL_PARAM_KEYS.county] = store.currentCounty
    }
    if (store.currentDataset) {
      query[URL_PARAM_KEYS.dataset] = store.currentDataset
    }
    if (store.currentYear) {
      query[URL_PARAM_KEYS.year] = store.currentYear
    }
    if (store.currentMetric) {
      query[URL_PARAM_KEYS.metric] = store.currentMetric
    }
    if (store.compareYear) {
      query[URL_PARAM_KEYS.compareYear] = store.compareYear
    }
    if (store.searchQuery) {
      query[URL_PARAM_KEYS.search] = store.searchQuery
    }
    if (store.hasActiveFilters && store.currentLevel !== 'state') {
      const encodedFilters = encodeFilters(store.dimensionFilters)
      if (encodedFilters) {
        query[URL_PARAM_KEYS.filters] = encodedFilters
      }
    }

    const newUrl = new URL(window.location.href)
    newUrl.search = ''
    Object.keys(query).forEach(key => {
      newUrl.searchParams.set(key, query[key])
    })

    window.history.pushState({}, '', newUrl.toString())
  }

  const getQueryParams = () => {
    const searchParams = new URL(window.location.href).searchParams
    const query = {}
    searchParams.forEach((value, key) => {
      query[key] = value
    })
    return query
  }

  const restoreFromUrl = () => {
    const query = getQueryParams()

    if (VALID_LEVELS.has(query[URL_PARAM_KEYS.level])) {
      store.currentLevel = query[URL_PARAM_KEYS.level]
    }
    if (query[URL_PARAM_KEYS.state]) {
      store.currentState = query[URL_PARAM_KEYS.state]
    }
    if (query[URL_PARAM_KEYS.county]) {
      store.currentCounty = query[URL_PARAM_KEYS.county]
    }
    if (query[URL_PARAM_KEYS.dataset] === REAL_ESTATE_DATASET) {
      store.currentDataset = query[URL_PARAM_KEYS.dataset]
    }
    if (query[URL_PARAM_KEYS.year]) {
      store.currentYear = query[URL_PARAM_KEYS.year]
    }
    if (query[URL_PARAM_KEYS.metric]) {
      store.currentMetric = query[URL_PARAM_KEYS.metric]
    }
    if (query[URL_PARAM_KEYS.compareYear]) {
      store.compareYear = query[URL_PARAM_KEYS.compareYear]
    }
    if (query[URL_PARAM_KEYS.search]) {
      store.searchQuery = query[URL_PARAM_KEYS.search]
    }
    if (query[URL_PARAM_KEYS.filters]) {
      const decodedFilters = decodeFilters(query[URL_PARAM_KEYS.filters])
      if (decodedFilters) {
        Object.assign(store.dimensionFilters, decodedFilters)
      }
    }
  }

  const syncNavigationToUrl = () => {
    watch(
      () => [store.currentLevel, store.currentState, store.currentCounty],
      () => updateUrl(),
      { immediate: false }
    )
  }

  const syncFiltersToUrl = () => {
    watch(
      () => [store.dimensionFilters, store.searchQuery],
      () => updateUrl(),
      { deep: true, immediate: false }
    )
  }

  const syncSelectionToUrl = () => {
    watch(
      () => [store.currentDataset, store.currentYear, store.currentMetric, store.compareYear],
      () => updateUrl(),
      { immediate: false }
    )
  }

  const setupPopStateHandler = () => {
    window.addEventListener('popstate', () => {
      restoreFromUrl()
    })
  }

  const init = () => {
    restoreFromUrl()
    syncNavigationToUrl()
    syncFiltersToUrl()
    syncSelectionToUrl()
    setupPopStateHandler()
  }

  return {
    init,
    updateUrl,
    restoreFromUrl,
    encodeFilters,
    decodeFilters
  }
}
