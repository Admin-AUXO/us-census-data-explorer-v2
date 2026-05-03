import { computed } from 'vue'
import { useCensusStore } from '../stores/census'

export const useFilterCount = () => {
  const store = useCensusStore()
  
  const hasActiveFilters = computed(() => {
    const f = store.dimensionFilters
    if (!f) return false
    return (
      (f.selectedStates?.length > 0 && f.selectedStates.length < 50) ||
      f.selectedRegions?.length > 0 ||
      f.selectedDivisions?.length > 0 ||
      f.selectedCongressionalDistricts?.length > 0 ||
      f.selectedAiannh?.length > 0 ||
      f.selectedUrbanRural?.length > 0 ||
      f.selectedMetroAreas?.length > 0 ||
      (f.areaMin != null && f.areaMin !== '') ||
      (f.areaMax != null && f.areaMax !== '') ||
      (f.metricValueMin != null && f.metricValueMin !== '') ||
      (f.metricValueMax != null && f.metricValueMax !== '') ||
      (f.populationMin != null && f.populationMin !== '') ||
      (f.populationMax != null && f.populationMax !== '') ||
      (f.incomeMin != null && f.incomeMin !== '') ||
      (f.incomeMax != null && f.incomeMax !== '') ||
      (f.ageMin != null && f.ageMin !== '') ||
      (f.ageMax != null && f.ageMax !== '') ||
      (f.densityMin != null && f.densityMin !== '') ||
      (f.densityMax != null && f.densityMax !== '') ||
      (f.vacancyMin != null && f.vacancyMin !== '') ||
      (f.vacancyMax != null && f.vacancyMax !== '') ||
      (f.yieldMin != null && f.yieldMin !== '') ||
      (f.affordabilityMin != null && f.affordabilityMin !== '') ||
      (f.pressureMax != null && f.pressureMax !== '') ||
      f.executivePreset !== ''
    )
  })
  
  const activeFilterCount = computed(() => {
    const f = store.dimensionFilters
    if (!f) return 0
    let count = 0
    if (f.selectedStates?.length > 0 && f.selectedStates.length < 50) count++
    if (f.selectedRegions?.length > 0) count++
    if (f.selectedDivisions?.length > 0) count++
    if (f.selectedCongressionalDistricts?.length > 0) count++
    if (f.selectedAiannh?.length > 0) count++
    if (f.selectedUrbanRural?.length > 0) count++
    if (f.selectedMetroAreas?.length > 0) count++
    if (f.areaMin != null && f.areaMin !== '') count++
    if (f.areaMax != null && f.areaMax !== '') count++
    if (f.metricValueMin != null && f.metricValueMin !== '') count++
    if (f.metricValueMax != null && f.metricValueMax !== '') count++
    if (f.populationMin != null && f.populationMin !== '') count++
    if (f.populationMax != null && f.populationMax !== '') count++
    if (f.incomeMin != null && f.incomeMin !== '') count++
    if (f.incomeMax != null && f.incomeMax !== '') count++
    if (f.ageMin != null && f.ageMin !== '') count++
    if (f.ageMax != null && f.ageMax !== '') count++
    if (f.densityMin != null && f.densityMin !== '') count++
    if (f.densityMax != null && f.densityMax !== '') count++
    if (f.vacancyMin != null && f.vacancyMin !== '') count++
    if (f.vacancyMax != null && f.vacancyMax !== '') count++
    if (f.yieldMin != null && f.yieldMin !== '') count++
    if (f.affordabilityMin != null && f.affordabilityMin !== '') count++
    if (f.pressureMax != null && f.pressureMax !== '') count++
    if (f.executivePreset !== '') count++
    return count
  })
  
  return {
    hasActiveFilters,
    activeFilterCount
  }
}
