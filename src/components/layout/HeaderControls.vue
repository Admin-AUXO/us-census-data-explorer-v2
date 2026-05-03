<template>
  <header class="command-bar" :class="{ 'is-scrolled': isScrolled }">
    <div class="command-bar-inner">
      <div class="command-row command-row--primary">
        <div class="brand-block">
          <div class="brand-line">
            <AuxoLogo size="small" />
            <div>
              <h1>Market Signal Board</h1>
              <p>Fast ACS reads for real-estate expansion, underwriting, and market selection.</p>
            </div>
          </div>
        </div>

        <nav class="geo-trail" aria-label="Geographic drilldown">
          <button :class="{ active: store.currentLevel === 'state' }" @click="navigateToState">
            <Globe2 :size="16" />
            U.S.
          </button>
          <ChevronRight :size="14" />
          <button :disabled="!store.currentState" :class="{ active: store.currentLevel === 'county' }" @click="navigateToCounty">
            <MapPin :size="16" />
            {{ store.currentState || 'State' }}
          </button>
        </nav>

        <div class="header-actions">
          <button class="icon-button" :class="{ active: filtersOpen }" @click="$emit('toggle-filters')" title="Filters">
            <SlidersHorizontal :size="17" />
            <span v-if="activeFilterCount" class="badge">{{ activeFilterCount }}</span>
          </button>
          <button class="icon-button" @click="copyLink" :class="{ success: linkCopied }" title="Copy link">
            <Check v-if="linkCopied" :size="17" />
            <Link2 v-else :size="17" />
          </button>
          <button class="icon-button" @click="toggleTheme" title="Toggle theme">
            <Moon v-if="isDark" :size="17" />
            <Sun v-else :size="17" />
          </button>
          <button class="export-button" @click="exportCurrentView">
            <Download :size="17" />
            Export
          </button>
        </div>
      </div>

      <div class="command-row command-row--filters" v-if="filtersOpen">
        <div class="filter-section filter-section--primary">
          <label class="filter-control filter-control--question">
            <span>Question</span>
            <select v-model="selectedMetric" @change="onMetricChange">
              <optgroup v-for="group in curatedMetricGroups" :key="group.label" :label="group.label">
                <option v-for="metric in group.metrics" :key="metric.value" :value="metric.value">
                  {{ metric.shortLabel }}
                </option>
              </optgroup>
            </select>
          </label>

          <div class="filter-control filter-control--lens">
            <span>Lens</span>
            <div class="lens-pills" role="group" aria-label="Strategy lens">
              <button
                v-for="lens in strategyLenses"
                :key="lens.value"
                type="button"
                :class="{ active: store.dimensionFilters.executivePreset === lens.value }"
                @click="store.dimensionFilters.executivePreset = store.dimensionFilters.executivePreset === lens.value ? '' : lens.value"
              >
                {{ lens.label }}
              </button>
            </div>
          </div>

          <label class="filter-control">
            <span>Vintage</span>
            <select v-model="selectedYear" @change="onYearChange">
              <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
            </select>
          </label>

          <label class="filter-control">
            <span>vs</span>
            <select v-model="selectedCompareYear" @change="handleCompareYearChange">
              <option value="">Prior year</option>
              <option v-for="year in compareYears" :key="year" :value="year">{{ year }}</option>
            </select>
          </label>
        </div>

        <div class="filter-section filter-section--geo">
          <label class="filter-control">
            <span>Region</span>
            <select v-model="selectedRegion">
              <option value="">All</option>
              <option v-for="region in regions" :key="region" :value="region">{{ region }}</option>
            </select>
          </label>

          <label class="filter-control">
            <span>State</span>
            <select v-model="selectedStateFilter">
              <option value="">All</option>
              <option v-for="state in states" :key="state" :value="state">{{ state }}</option>
            </select>
          </label>

          <div class="filter-control">
            <span>Search</span>
            <div class="search-box">
              <Search :size="14" />
              <input v-model="store.searchQuery" placeholder="City, county..." />
              <button v-if="store.searchQuery" @click="store.searchQuery = ''" type="button" aria-label="Clear">
                <X :size="12" />
              </button>
            </div>
          </div>
        </div>

        <div class="filter-section filter-section--advanced" :class="{ expanded: advancedOpen }">
          <button type="button" class="advanced-toggle" @click="advancedOpen = !advancedOpen">
            <SlidersHorizontal :size="14" />
            More filters
            <ChevronDown :size="14" :class="{ rotated: advancedOpen }" />
          </button>

          <div class="advanced-filters" v-if="advancedOpen">
            <label class="filter-control">
              <span>Signal floor</span>
              <input v-model="store.dimensionFilters.metricValueMin" type="number" inputmode="decimal" placeholder="Min" />
            </label>

            <label class="filter-control">
              <span>Income</span>
              <div class="range-pair">
                <input v-model="store.dimensionFilters.incomeMin" type="number" inputmode="numeric" placeholder="Min" />
                <input v-model="store.dimensionFilters.incomeMax" type="number" inputmode="numeric" placeholder="Max" />
              </div>
            </label>

            <label class="filter-control">
              <span>Population</span>
              <input v-model="store.dimensionFilters.populationMin" type="number" inputmode="numeric" placeholder="Min" />
            </label>

            <label class="filter-control">
              <span>Age</span>
              <div class="range-pair">
                <input v-model="store.dimensionFilters.ageMin" type="number" inputmode="decimal" placeholder="Min" />
                <input v-model="store.dimensionFilters.ageMax" type="number" inputmode="decimal" placeholder="Max" />
              </div>
            </label>

            <label class="filter-control">
              <span>Yield / Vac</span>
              <div class="range-pair">
                <input v-model="store.dimensionFilters.yieldMin" type="number" inputmode="decimal" placeholder="Min %" />
                <input v-model="store.dimensionFilters.vacancyMax" type="number" inputmode="decimal" placeholder="Max %" />
              </div>
            </label>
          </div>
        </div>

        <button class="reset-button" @click="store.resetFilters()" v-if="hasActiveFilters">
          <RotateCcw :size="14" />
          Clear
        </button>
      </div>
    </div>

    <div v-if="store.isLoading" class="loading-bar">
      <div class="loading-progress" :style="{ width: `${store.loadingProgress.percentage || 12}%` }"></div>
    </div>
  </header>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Check, ChevronRight, ChevronDown, Download, Globe2, Link2, MapPin, Moon,
  RotateCcw, Search, SlidersHorizontal, Sun, X
} from 'lucide-vue-next'
import AuxoLogo from '../common/AuxoLogo.vue'
import { useCensusStore } from '../../stores/census'
import { useFilterCount } from '../../composables/useFilterCount'
import { useFilters } from '../../composables/useFilters'
import { useTheme } from '../../composables/useTheme'
import { useExport } from '../../composables/useExport'
import { getStateName } from '../../utils/censusAccessors'

const props = defineProps({
  filtersOpen: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-filters'])

const REAL_ESTATE_METRICS = [
  'market_opportunity_score',
  'executive_growth_score',
  'median_home_value',
  'median_gross_rent',
  'gross_rental_yield',
  'housing_affordability_index',
  'cost_pressure_index',
  'housing_vacancy_rate',
  'consumer_demand_index',
  'median_household_income',
  'total_population',
  'median_age',
  'affluence_index'
]

const REGION_NAMES = {
  1: 'Northeast',
  2: 'Midwest',
  3: 'South',
  4: 'West'
}

const store = useCensusStore()
const { activeFilterCount } = useFilterCount()
const {
  selectedYear,
  selectedMetric,
  selectedCompareYear,
  availableYears,
  availableMetrics,
  compareYears,
  onYearChange,
  onMetricChange,
  handleCompareYearChange
} = useFilters()
const { isDark, toggleTheme } = useTheme()
const { exportToCSV } = useExport()
const isScrolled = ref(false)
const linkCopied = ref(false)
const advancedOpen = ref(false)

const filtersOpen = computed(() => props.filtersOpen)
const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const strategyLenses = [
  { value: '', label: 'All' },
  { value: 'expansion', label: 'Expand' },
  { value: 'rental', label: 'Rental' },
  { value: 'luxury', label: 'Premium' },
  { value: 'risk', label: 'Risk' }
]

const curatedMetrics = computed(() => {
  const preferred = new Set(REAL_ESTATE_METRICS)
  const available = availableMetrics.value.filter((metric) => preferred.has(metric.base))
  const metrics = available.length ? available : availableMetrics.value.slice(0, 10)
  return metrics.map((metric) => ({
    ...metric,
    shortLabel: metricLabels[metric.base] || metric.label,
    groupLabel: metricGroups[metric.base] || 'Other signals'
  }))
})

const curatedMetricGroups = computed(() => {
  const groups = new Map()
  curatedMetrics.value.forEach((metric) => {
    if (!groups.has(metric.groupLabel)) groups.set(metric.groupLabel, [])
    groups.get(metric.groupLabel).push(metric)
  })
  return [...groups.entries()].map(([label, metrics]) => ({ label, metrics }))
})

const states = computed(() => {
  const stateRows = store.data.state || []
  return [...new Set(stateRows.map(getStateName).filter(Boolean))].sort()
})

const regions = computed(() => {
  const stateRows = store.data.state || []
  return [...new Set(stateRows
    .map((row) => REGION_NAMES[row.census_region] || REGION_NAMES[String(row.census_region)] || null)
    .filter(Boolean))]
})

const selectedRegion = computed({
  get: () => store.dimensionFilters.selectedRegions[0] || '',
  set: (value) => {
    store.dimensionFilters.selectedRegions = value ? [value] : []
  }
})

const selectedStateFilter = computed({
  get: () => store.dimensionFilters.selectedStates.length === 1 ? store.dimensionFilters.selectedStates[0] : '',
  set: (value) => {
    store.dimensionFilters.selectedStates = value ? [value] : []
  }
})

const metricLabels = {
  market_opportunity_score: 'Overall market fit',
  executive_growth_score: 'Expansion readiness',
  median_home_value: 'Entry price',
  median_gross_rent: 'Rent baseline',
  gross_rental_yield: 'Rental yield',
  housing_affordability_index: 'Affordability room',
  cost_pressure_index: 'Cost pressure',
  housing_vacancy_rate: 'Vacancy risk',
  consumer_demand_index: 'Demand strength',
  median_household_income: 'Household income',
  total_population: 'Market scale',
  median_age: 'Age profile',
  affluence_index: 'Premium demand'
}

const metricGroups = {
  market_opportunity_score: 'Board-level scores',
  executive_growth_score: 'Board-level scores',
  consumer_demand_index: 'Board-level scores',
  affluence_index: 'Demand',
  median_household_income: 'Demand',
  total_population: 'Demand',
  median_age: 'Demand',
  median_home_value: 'Housing economics',
  median_gross_rent: 'Housing economics',
  gross_rental_yield: 'Housing economics',
  housing_affordability_index: 'Risk and affordability',
  cost_pressure_index: 'Risk and affordability',
  housing_vacancy_rate: 'Risk and affordability'
}

function navigateToState() {
  store.currentLevel = 'state'
  store.currentState = null
  store.currentCounty = null
}

function navigateToCounty() {
  if (!store.currentState) return
  store.currentLevel = 'county'
  store.currentCounty = null
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    linkCopied.value = true
    setTimeout(() => {
      linkCopied.value = false
    }, 1400)
  } catch (error) {
    console.error('Failed to copy link:', error)
  }
}

function exportCurrentView() {
  const data = store.filteredData || []
  if (!data.length) return
  exportToCSV(data, `real_estate_markets_${store.currentLevel}_${store.currentYear || 'current'}`, {
    includeMetadata: true
  })
}

function updateScrollState() {
  isScrolled.value = window.scrollY > 8
}

onMounted(() => {
  window.addEventListener('scroll', updateScrollState, { passive: true })
  updateScrollState()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateScrollState)
})
</script>

<style scoped>
.command-bar {
  position: sticky;
  top: 0;
  z-index: var(--z-index-sticky);
  background: rgb(var(--bg-primary-rgb), 0.94);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border-color);
}

.command-bar.is-scrolled {
  box-shadow: var(--shadow-md);
}

.command-bar-inner {
  width: 100%;
  max-width: min(98vw, 1680px);
  margin: 0 auto;
  padding: 0.65rem clamp(0.85rem, 1.4vw, 1.35rem);
  display: grid;
  gap: 0.55rem;
}

.command-row {
  display: grid;
  gap: 0.75rem;
  align-items: center;
}

.command-row--primary {
  grid-template-columns: minmax(300px, 1.15fr) minmax(320px, 0.9fr) auto;
}

.brand-line,
.geo-trail,
.header-actions,
.search-box,
.reset-button,
.icon-button,
.export-button {
  display: flex;
  align-items: center;
}

.brand-line {
  gap: 0.8rem;
}

.brand-block h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.05rem, 0.7vw + 0.9rem, 1.35rem);
  line-height: 1.1;
}

.brand-block p {
  margin: 0.18rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.geo-trail {
  gap: 0.35rem;
  justify-self: center;
  color: var(--text-tertiary);
  min-width: 0;
}

.geo-trail button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 34px;
  padding: 0 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 700;
  max-width: 190px;
}

.geo-trail button.active {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.geo-trail button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.header-actions {
  justify-content: flex-end;
  gap: 0.45rem;
}

.icon-button,
.export-button,
.reset-button {
  position: relative;
  justify-content: center;
  min-height: 38px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 800;
}

.icon-button {
  width: 38px;
}

.icon-button:hover,
.export-button:hover,
.reset-button:hover,
.icon-button.active,
.icon-button.success {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.export-button,
.reset-button {
  gap: 0.4rem;
  padding: 0 0.85rem;
}

.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  background: var(--accent-green);
  color: var(--text-on-accent);
  font-size: 10px;
  display: grid;
  place-items: center;
}

.command-row--filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  align-items: flex-end;
}

.filter-section {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
}

.filter-section--primary {
  flex: 2;
  min-width: 320px;
}

.filter-section--geo {
  flex: 1;
  min-width: 200px;
}

.filter-section--advanced {
  flex: 1;
  min-width: 280px;
  align-items: center;
}

.filter-control {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 90px;
}

.filter-control--question {
  min-width: 160px;
  flex: 1;
}

.filter-control--lens {
  min-width: 200px;
}

.filter-control span {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.filter-control small {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.3;
}

.filter-control select,
.filter-control input {
  width: 100%;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  padding: 0 0.5rem;
  font-weight: 700;
  min-width: 0;
  font-size: var(--font-size-sm);
}

.filter-control select option,
.filter-control select optgroup {
  background: var(--bg-card);
  color: var(--text-primary);
}

.filter-control select option:checked {
  background: var(--accent-blue);
  color: var(--text-on-accent);
}

.lens-pills {
  display: flex;
  gap: 0.25rem;
  padding: 0.15rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.lens-pills button {
  flex: 1;
  min-height: 26px;
  padding: 0 0.5rem;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 900;
  font-size: 11px;
  white-space: nowrap;
}

.lens-pills button:hover {
  background: rgb(var(--accent-green-rgb), 0.08);
  color: var(--text-primary);
}

.lens-pills button.active {
  background: var(--accent-green);
  color: var(--bg-primary);
}

.search-box {
  position: relative;
  height: 32px;
}

.search-box svg {
  position: absolute;
  left: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}

.search-box input {
  padding-left: 1.6rem;
  padding-right: 1.6rem;
}

.search-box button {
  position: absolute;
  right: 0.3rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0.2rem;
}

.search-box button:hover {
  color: var(--text-primary);
}

.range-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.25rem;
}

.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 32px;
  padding: 0 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 800;
  font-size: 11px;
  white-space: nowrap;
}

.advanced-toggle:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.advanced-toggle svg {
  transition: transform var(--duration-fast);
}

.advanced-toggle svg.rotated {
  transform: rotate(180deg);
}

.advanced-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 100%;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color);
  margin-top: 0.5rem;
}

.reset-button {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  height: 32px;
  padding: 0 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-weight: 800;
  font-size: 11px;
}

.reset-button:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.loading-bar {
  height: 3px;
  background: var(--bg-secondary);
  overflow: hidden;
}

.loading-progress {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-green));
  transition: width var(--duration-fast);
}

@media (max-width: 1400px) {
  .filter-section--primary {
    min-width: 280px;
  }
}

@media (max-width: 1240px) {
  .command-row--primary {
    grid-template-columns: 1fr auto;
    gap: 1rem;
  }

  .geo-trail {
    order: 3;
    grid-column: 1 / -1;
    justify-self: start;
  }

  .brand-block {
    flex: 1;
  }
}

@media (max-width: 1024px) {
  .command-row--filters {
    flex-direction: column;
  }

  .filter-section {
    width: 100%;
  }

  .filter-section--primary {
    flex-wrap: wrap;
    gap: 0.75rem;
  }
}

@media (max-width: 768px) {
  .command-bar-inner {
    padding: 0.5rem;
  }

  .command-row--primary {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .geo-trail {
    display: none;
  }

  .header-actions {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  .filter-section--primary {
    flex-direction: column;
  }

  .filter-control {
    width: 100%;
    min-width: unset;
  }

  .lens-pills {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .brand-block h1 {
    font-size: 0.9rem;
  }

  .brand-block p {
    display: none;
  }

  .filter-control span {
    font-size: 9px;
  }
}
</style>
