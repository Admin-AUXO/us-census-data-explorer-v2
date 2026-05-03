<template>
  <div id="app">
    <div class="scroll-tracker" :style="{ width: `${scrollPercentage}%` }"></div>
    <HeaderControls :filters-open="filtersOpen" @toggle-filters="filtersOpen = !filtersOpen" />
    <HelpPanel v-if="showHelp" @close="showHelp = false" />

    <main class="main-content" :class="{ transitioning: store.isLevelTransitioning }">
      <div class="container">
        <ErrorBanner
          v-if="store.hasError && !store.isLoading"
          :visible="true"
          severity="error"
          title="Failed to Load Real Estate Data"
          :message="store.errorMessage"
          suggestion="Check public/data real-estate files and refresh."
          :dismissible="true"
          @dismiss="store.clearError()"
        />
        <MarketExplorer />
      </div>
    </main>

    <footer class="footer">
      <div class="footer-container">
        <div class="footer-main">
          <div class="footer-brand">
            <AuxoLogo size="small" />
            <span class="brand-site">auxodata.com</span>
          </div>
          <div class="footer-sections">
            <div class="footer-section">
              <h4>Purpose</h4>
              <p>Market screening board for expansion, underwriting, and site selection decisions.</p>
            </div>
            <div class="footer-section">
              <h4>Data</h4>
              <p>ACS 5-Year Estimates: housing, income, demographics, rent, vacancy, and affordability.</p>
            </div>
            <div class="footer-section">
              <h4>Links</h4>
              <div class="footer-links">
                <a href="https://www.census.gov/data/developers/data-sets/acs-5year.html" target="_blank" rel="noopener noreferrer">
                  <ExternalLink :size="14" />
                  <span>ACS 5-Year</span>
                </a>
                <a href="https://data.census.gov" target="_blank" rel="noopener noreferrer">
                  <ExternalLink :size="14" />
                  <span>Data Portal</span>
                </a>
                <a href="#" @click.prevent="showHelp = true">
                  <Info :size="14" />
                  <span>Guide</span>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div class="footer-bottom">
          <p>For screening only. Validate with local comps, broker intel, and实地 due diligence before any capital commitment.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ExternalLink, Info } from 'lucide-vue-next'
import AuxoLogo from './components/common/AuxoLogo.vue'
import ErrorBanner from './components/common/ErrorBanner.vue'
import HelpPanel from './components/common/HelpPanel.vue'
import HeaderControls from './components/layout/HeaderControls.vue'
import MarketExplorer from './components/data/MarketExplorer.vue'
import { useCensusStore } from './stores/census'
import { useKeyboardNavigation } from './composables/useKeyboardNavigation'
import { useTheme } from './composables/useTheme'
import { useUrlState } from './composables/useUrlState'

const REAL_ESTATE_DATASET = 'industry_realestate_2018_2024'
const DEFAULT_METRIC_BASE = 'market_opportunity_score'

const store = useCensusStore()
const { initTheme } = useTheme()
const { init: initUrlState } = useUrlState()
const showHelp = ref(false)
const filtersOpen = ref(false)
const scrollPercentage = ref(0)

useKeyboardNavigation({
  onToggleHelp: () => { showHelp.value = !showHelp.value },
  onToggleFilters: () => { filtersOpen.value = !filtersOpen.value },
  onOpenCommandPalette: () => {}
})

async function loadRealEstateDashboard() {
  store.currentDataset = REAL_ESTATE_DATASET
  await store.loadDataset(REAL_ESTATE_DATASET)
  await nextTick()

  const latestYear = store.availableYears[0] || '2024'
  store.currentYear = latestYear

  const metric = `${DEFAULT_METRIC_BASE}_${latestYear}`
  const firstRow = store.data.state?.[0] || {}
  store.currentMetric = firstRow[metric] !== undefined ? metric : Object.keys(firstRow).find((key) => key.endsWith(`_${latestYear}`)) || null
  store.compareYear = null
  store.savePreferences()
}

function updateScrollTracker() {
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const scrollableHeight = documentHeight - windowHeight
  scrollPercentage.value = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0
}

function handleKeydown(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return
  if (event.key === 'Escape') {
    if (showHelp.value) showHelp.value = false
    else if (filtersOpen.value) filtersOpen.value = false
  } else if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
    event.preventDefault()
    showHelp.value = !showHelp.value
  }
}

onMounted(async () => {
  initTheme()
  initUrlState()
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('scroll', updateScrollTracker, { passive: true })
  window.addEventListener('resize', updateScrollTracker, { passive: true })
  updateScrollTracker()

  try {
    if (!store.manifest) await store.loadManifest()
    await loadRealEstateDashboard()
  } catch (error) {
    console.error('Failed to initialize real estate dashboard:', error)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('scroll', updateScrollTracker)
  window.removeEventListener('resize', updateScrollTracker)
})
</script>
