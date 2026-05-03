<template>
  <section class="market-explorer">
    <div class="use-case-band" :class="{ 'use-case-band--collapsed': briefingCollapsed }">
      <div class="use-case-copy">
        <div class="briefing-title-row">
          <div>
            <span class="section-eyebrow">Real estate market board</span>
            <h2>Find the next market to investigate.</h2>
          </div>
          <button class="collapse-briefing" @click="briefingCollapsed = !briefingCollapsed">
            <ChevronDown :class="{ rotated: briefingCollapsed }" :size="17" />
            {{ briefingCollapsed ? 'Show brief' : 'Hide brief' }}
          </button>
        </div>
        <p v-if="!briefingCollapsed">
          Compare seven ACS vintages across demand, rent, affordability, and risk.
          Pick a lens, scan the charts, then open a card when a market deserves a closer look.
        </p>
      </div>
      <div v-if="!briefingCollapsed" class="use-case-grid" aria-label="Dashboard use cases">
        <button
          v-for="item in useCases"
          :key="item.title"
          class="use-case-card"
          :class="{ active: selectedLens === item.lens }"
          type="button"
          @click="selectLens(item.lens)"
        >
          <component :is="item.icon" :size="18" />
          <div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.copy }}</p>
          </div>
        </button>
      </div>
      <aside v-if="!briefingCollapsed" class="quick-help-panel" aria-label="How to use this board">
        <button class="quick-help-toggle" type="button" @click="helpPanelOpen = !helpPanelOpen">
          <HelpCircle :size="17" />
          {{ helpPanelOpen ? 'Hide quick guide' : 'How should I read this?' }}
        </button>
        <div v-if="helpPanelOpen" class="quick-help-body">
          <div v-for="item in quickHelp" :key="item.title">
            <strong>{{ item.title }}</strong>
            <p>{{ item.copy }}</p>
          </div>
        </div>
      </aside>
    </div>

    <div v-if="!store.currentMetric || !rows.length || !rankedRows.length" class="market-empty">
      <Building2 :size="44" />
      <h3>{{ emptyTitle }}</h3>
      <p>{{ emptyCopy }}</p>
    </div>

    <template v-else>
      <div class="insight-grid">
        <article class="insight-card insight-card--lead">
          <span class="card-label">Top result in current screen</span>
          <h3>{{ leader.name }}</h3>
          <strong>{{ formatMetric(leader.value) }}</strong>
          <p>{{ summary }}</p>
        </article>
        <article v-for="kpi in kpis" :key="kpi.label" class="insight-card">
          <span class="card-label">{{ kpi.label }}</span>
          <strong>{{ kpi.value }}</strong>
          <p>{{ kpi.note }}</p>
        </article>
      </div>

      <div class="chart-grid" aria-label="Market charts">
        <section class="chart-card chart-card--trend">
          <header>
            <span>Momentum</span>
            <strong>{{ leader.name }}</strong>
          </header>
          <div class="chart-canvas-frame">
            <Line :data="trendChartData" :options="trendChartOptions" class="market-chart" />
          </div>
          <div class="chart-foot">
            <span>{{ trendStartLabel }}</span>
            <b>{{ leaderTrendLabel }}</b>
            <span>{{ trendEndLabel }}</span>
          </div>
        </section>

        <section class="chart-card">
          <header>
            <span>Leaderboard</span>
            <strong>{{ rankLabel }}</strong>
          </header>
          <div class="chart-canvas-frame">
            <Bar :data="leaderboardChartData" :options="leaderboardChartOptions" class="market-chart market-chart--bars" />
          </div>
        </section>

        <section class="chart-card">
          <header>
            <span>Demand vs risk</span>
            <strong>{{ scatterSummary }}</strong>
          </header>
          <div class="chart-canvas-frame">
            <Scatter :data="scatterChartData" :options="scatterChartOptions" class="market-chart market-chart--scatter" />
          </div>
          <div class="chart-foot">
            <span>Lower risk</span>
            <b>sweet spot: upper left</b>
            <span>Higher demand</span>
          </div>
        </section>
      </div>

      <div class="drilldown-shell">
        <div class="drilldown-header">
          <div>
            <span class="section-eyebrow">{{ levelLabel }}</span>
            <h2>{{ drilldownTitle }}</h2>
            <p>{{ drilldownHint }}</p>
          </div>
          <div class="drilldown-actions">
            <label class="rank-control">
              <span>Rank by</span>
              <select v-model="rankMode">
                <option v-for="option in rankOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <button v-if="store.currentLevel !== 'state'" class="ghost-button" @click="store.goBack()">
              <ArrowLeft :size="16" />
              Back
            </button>
            <button class="ghost-button" :class="{ active: shortlistOnly }" :disabled="!shortlistCount" @click="shortlistOnly = !shortlistOnly">
              <Star :size="16" />
              Shortlist {{ shortlistCount || '' }}
            </button>
            <button class="ghost-button" @click="store.resetFilters()">
              <RotateCcw :size="16" />
              Reset filters
            </button>
          </div>
        </div>

        <div class="market-grid">
          <article
            v-for="row in rankedRows"
            :key="row.key"
            class="market-card"
            :class="{ 'market-card--clickable': store.currentLevel === 'state' }"
            :role="store.currentLevel === 'state' ? 'button' : undefined"
            :tabindex="store.currentLevel === 'state' ? 0 : undefined"
            @click="openMarket(row)"
            @keydown.enter.prevent="openMarket(row)"
          >
            <div class="market-card-top">
              <div>
                <span class="rank">#{{ row.rank }}</span>
                <h3>{{ row.name }}</h3>
              </div>
              <div class="score-block">
                <span class="score">{{ formatMetric(row.value) }}</span>
                <span :class="['delta-chip', row.deltaTone]">{{ row.delta }}</span>
              </div>
            </div>
            <div class="signal-meter" aria-hidden="true">
              <span :style="{ width: `${row.intensity}%` }"></span>
            </div>
            <div class="comparison-row">
              <span>{{ row.percentile }}</span>
              <span>{{ row.quartileSignal }}</span>
            </div>
            <div class="fact-groups">
              <section v-for="group in row.factGroups" :key="group.title" class="fact-group">
                <h4>{{ group.title }}</h4>
                <dl class="fact-grid">
                  <div v-for="fact in group.facts" :key="fact.label">
                    <dt>{{ fact.label }}</dt>
                    <dd>{{ fact.value }}</dd>
                  </div>
                </dl>
              </section>
            </div>
            <div class="thesis-strip">
              <span v-for="signal in row.signals" :key="signal" class="thesis-pill">{{ signal }}</span>
            </div>
            <p class="market-note">{{ row.note }}</p>
            <div class="card-actions">
              <button v-if="store.currentLevel === 'state'" class="drilldown-button" @click.stop="drillToCounty(row)">
                <MapPinned :size="14" />
                Counties
              </button>
              <button v-if="store.currentLevel === 'county'" class="drilldown-button" @click.stop="drillToZcta(row)">
                <MapPinned :size="14" />
                ZIPs
              </button>
              <button class="shortlist-button" :class="{ active: isShortlisted(row) }" @click.stop="toggleShortlist(row)">
                <Star :size="14" />
                {{ isShortlisted(row) ? 'Saved' : 'Save' }}
              </button>
              <button class="details-link" @click.stop="openMarket(row)">
                Brief
                <ArrowRight :size="14" />
              </button>
            </div>
          </article>
        </div>
      </div>
    </template>

    <Teleport to="body">
      <div v-if="selectedMarket" class="market-modal" @click.self="selectedMarket = null">
        <section class="market-modal-panel" role="dialog" aria-modal="true" :aria-label="`${selectedMarket.name} market dossier`">
          <header class="market-modal-header">
            <div>
              <span class="section-eyebrow">Market dossier</span>
              <h2>{{ selectedMarket.name }}</h2>
              <p>{{ selectedMarket.modalSummary }}</p>
            </div>
            <button class="modal-close" @click="selectedMarket = null" aria-label="Close market dossier">
              <X :size="18" />
            </button>
          </header>

          <div class="modal-score-grid">
            <article>
              <span>Rank score</span>
              <strong>{{ formatMetric(selectedMarket.value) }}</strong>
              <p>{{ selectedMarket.delta }} vs visible average</p>
            </article>
            <article>
              <span>Risk posture</span>
              <strong>{{ selectedMarket.riskPosture }}</strong>
              <p>{{ selectedMarket.riskCopy }}</p>
            </article>
            <article>
              <span>Demand posture</span>
              <strong>{{ selectedMarket.demandPosture }}</strong>
              <p>{{ selectedMarket.demandCopy }}</p>
            </article>
            <article>
              <span>Trend</span>
              <strong>{{ selectedMarket.trendPosture }}</strong>
              <p>{{ selectedMarket.trendCopy }}</p>
            </article>
          </div>

          <div class="modal-insight-grid">
            <article v-for="insight in selectedMarket.insights" :key="insight.label" class="modal-insight">
              <span>{{ insight.label }}</span>
              <strong>{{ insight.value }}</strong>
              <p>{{ insight.note }}</p>
            </article>
          </div>

          <div class="modal-next-strip">
            <span v-for="step in selectedMarket.nextSteps" :key="step">{{ step }}</span>
          </div>

          <div class="modal-actions">
            <button v-if="store.currentLevel === 'state'" class="primary-action" @click="drill(selectedMarket.raw); selectedMarket = null">
              Drill into counties
              <ArrowRight :size="15" />
            </button>
            <button class="ghost-button" @click="toggleShortlist(selectedMarket)">
              <Star :size="15" />
              {{ isShortlisted(selectedMarket) ? 'Saved' : 'Save market' }}
            </button>
            <button class="ghost-button" @click="selectedMarket = null">Close</button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Bar, Line, Scatter } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import {
  ArrowLeft, ArrowRight, Building2, ChevronDown, HelpCircle, Home, Landmark, MapPinned, RotateCcw, ShieldCheck, Star, X
} from 'lucide-vue-next'
import { useCensusStore } from '../../stores/census'
import { getCountyName, getMetricValue, getStateName } from '../../utils/censusAccessors'
import { formatValue } from '../../utils/formatUtils'
import { useExecutiveInsights } from '../../composables/useExecutiveInsights'
import { useFilters } from '../../composables/useFilters'
import { watch } from 'vue'

ChartJS.register(
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  annotationPlugin
)

const store = useCensusStore()
const { metricLabel } = useExecutiveInsights()
const { setMetricByBase } = useFilters()
const briefingCollapsed = ref(false)
const helpPanelOpen = ref(true)
const selectedMarket = ref(null)
const rankMode = ref('selected')
const shortlistOnly = ref(false)
const shortlisted = ref(new Set())
const trendYears = ['2018', '2019', '2020', '2021', '2022', '2023', '2024']

const useCases = [
  {
    title: 'Expansion shortlist',
    lens: 'expansion',
    copy: 'Find markets with scale, income, and demand worth the next meeting.',
    icon: MapPinned
  },
  {
    title: 'Rental yield',
    lens: 'rental',
    copy: 'Screen rent, yield, vacancy, and renter depth without opening a table.',
    icon: Home
  },
  {
    title: 'Premium demand',
    lens: 'luxury',
    copy: 'Spot higher-income markets where pricing power may hold up.',
    icon: Landmark
  },
  {
    title: 'Risk review',
    lens: 'risk',
    copy: 'Flag cost pressure, soft demand, and supply risk before diligence spend.',
    icon: ShieldCheck
  }
]

const quickHelp = [
  {
    title: 'Start broad',
    copy: 'Use the lens buttons first. They are faster than tuning every filter.'
  },
  {
    title: 'Trust the cards',
    copy: 'Each card combines demand base, housing economics, rank, and a short read.'
  },
  {
    title: 'Then drill',
    copy: 'Open a dossier for the short story. Drill into counties only when the state is worth it.'
  }
]

const selectedLens = computed(() => store.dimensionFilters.executivePreset || 'all')

const lensMetricMap = {
  expansion: 'executive_growth_score',
  rental: 'gross_rental_yield',
  luxury: 'median_household_income',
  risk: 'cost_pressure_index'
}

watch(selectedLens, (lens) => {
  if (!lens || lens === 'all') {
    rankMode.value = 'selected'
  } else {
    rankMode.value = lens === 'risk' ? 'lowerRisk' : lens
    if (lensMetricMap[lens]) {
      setMetricByBase(lensMetricMap[lens])
    }
  }
})

const rankOptions = [
  { value: 'selected', label: 'Selected signal' },
  { value: 'expansion', label: 'Expansion score' },
  { value: 'rental', label: 'Rental score' },
  { value: 'premium', label: 'Premium score' },
  { value: 'risk', label: 'Risk score' },
  { value: 'opportunity', label: 'Market opportunity' },
  { value: 'affordability', label: 'Affordability' },
  { value: 'demand', label: 'Demand strength' },
  { value: 'income', label: 'Household income' },
  { value: 'population', label: 'Market scale' },
  { value: 'tightSupply', label: 'Tight supply' }
]

const rankLabel = computed(() => {
  if (rankMode.value === 'selected') return metricLabel.value || 'Selected signal'
  return rankOptions.find((option) => option.value === rankMode.value)?.label || 'Selected signal'
})

const selectedYearLabel = computed(() => `${trendStartLabel.value}-${trendEndLabel.value}`)

const rankMetricBase = computed(() => {
  if (rankMode.value === 'selected') return (store.currentMetric || '').replace(/_\d{4}$/, '')
  const map = {
    opportunity: 'market_opportunity_score',
    affordability: 'housing_affordability_index',
    demand: 'consumer_demand_index',
    population: 'total_population',
    income: 'median_household_income',
    tightSupply: 'housing_vacancy_rate'
  }
  return map[rankMode.value] || rankMode.value
})

const rows = computed(() => Array.isArray(store.filteredData) ? store.filteredData : [])
const shortlistCount = computed(() => shortlisted.value.size)
const emptyTitle = computed(() => {
  if (!store.currentMetric) return 'Loading real estate signals'
  if (shortlistOnly.value) return 'Your shortlist is empty'
  return 'No markets match this screen'
})
const emptyCopy = computed(() => {
  if (!store.currentMetric) return 'The board loads one seven-year ACS real-estate dataset.'
  if (shortlistOnly.value) return 'Save a few markets from the main view, then come back here.'
  return 'Loosen a filter or switch strategy lens to bring markets back into view.'
})
const metricValues = computed(() => rows.value
  .map((row) => rankScore(row))
  .filter(Number.isFinite)
)
const minValue = computed(() => metricValues.value.length ? Math.min(...metricValues.value) : 0)
const maxValue = computed(() => metricValues.value.length ? Math.max(...metricValues.value) : 0)
const range = computed(() => Math.max(1, maxValue.value - minValue.value))
const averageValue = computed(() => {
  if (!metricValues.value.length) return null
  return metricValues.value.reduce((sum, value) => sum + value, 0) / metricValues.value.length
})
const distribution = computed(() => {
  const values = metricValues.value.slice().sort((left, right) => left - right)
  if (!values.length) return { q1: null, q3: null }
  return {
    q1: values[Math.floor((values.length - 1) * 0.25)],
    q3: values[Math.floor((values.length - 1) * 0.75)]
  }
})

const topChartRows = computed(() => {
  const max = Math.max(...rankedRows.value.slice(0, 8).map((row) => Math.abs(row.value)), 1)
  return rankedRows.value.slice(0, 8).map((row) => ({
    ...row,
    width: Math.max(6, Math.min(100, (Math.abs(row.value) / max) * 100))
  }))
})

const chartColors = {
  blue: '#68b7ff',
  green: '#b7f85d',
  amber: '#f7c35f',
  text: '#dbeafe',
  muted: '#8fb3cf',
  grid: 'rgba(143, 179, 207, 0.16)',
  surface: 'rgba(8, 18, 31, 0.94)'
}

const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 650, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: chartColors.surface,
      borderColor: 'rgba(143, 179, 207, 0.24)',
      borderWidth: 1,
      bodyColor: chartColors.text,
      titleColor: chartColors.text,
      titleFont: { weight: '800' },
      bodyFont: { weight: '700' },
      padding: 10,
      displayColors: false
    }
  }
}

const trendSeries = computed(() => {
  const raw = leader.value?.raw
  if (!raw) return []
  return trendYears
    .map((year) => ({ year, value: rankScore(raw, year) }))
    .filter((point) => Number.isFinite(point.value))
})

const trendStartLabel = computed(() => trendSeries.value[0]?.year || '2018')
const trendEndLabel = computed(() => trendSeries.value.at(-1)?.year || '2024')
const leaderTrendLabel = computed(() => trendPosture(leader.value?.raw || {}).trendPosture)

const scatterPoints = computed(() => rankedRows.value.slice(0, 12).map((row) => {
  const demand = metricNumber(row.raw, metricForYear('consumer_demand_index'))
  const risk = metricNumber(row.raw, metricForYear('cost_pressure_index'))
  if (!Number.isFinite(demand) || !Number.isFinite(risk)) return null
  return {
    key: row.key,
    name: row.name,
    rank: row.rank,
    demand: Math.min(100, Math.max(0, demand)),
    risk: Math.min(100, Math.max(0, risk)),
    score: row.value,
    population: metricNumber(row.raw, 'total_population')
  }
}).filter(Boolean))

const trendChartData = computed(() => ({
  labels: trendSeries.value.map((point) => point.year),
  datasets: [{
    label: rankLabel.value,
    data: trendSeries.value.map((point) => point.value),
    borderColor: chartColors.green,
    backgroundColor: 'rgba(183, 248, 93, 0.13)',
    pointBackgroundColor: chartColors.blue,
    pointBorderColor: chartColors.green,
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 4,
    fill: true,
    tension: 0.36
  }]
}))

const trendChartOptions = computed(() => {
  const values = trendSeries.value.map((point) => point.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const padding = Math.max(1, (max - min) * 0.14)

  return {
    ...baseChartOptions,
    scales: {
      x: {
        grid: { color: 'rgba(143, 179, 207, 0.08)', drawBorder: false },
        ticks: { color: chartColors.muted, font: { weight: '800' } }
      },
      y: {
      min: Math.floor(min - padding),
      max: Math.ceil(max + padding),
        grid: { color: chartColors.grid, drawBorder: false },
        ticks: { color: chartColors.muted, callback: (value) => formatMetric(value) }
      }
    },
    plugins: {
      ...baseChartOptions.plugins,
      tooltip: {
        ...baseChartOptions.plugins.tooltip,
        callbacks: {
          label: (context) => `${rankLabel.value}: ${formatMetric(context.parsed.y)}`
        }
      }
    }
  }
})

const leaderboardChartData = computed(() => {
  const rows = topChartRows.value.slice().reverse()
  return {
    labels: rows.map((row) => row.name),
    datasets: [{
      label: rankLabel.value,
      data: rows.map((row) => row.value),
      borderRadius: 8,
      borderSkipped: false,
      backgroundColor: (context) => {
        const chart = context.chart
        const area = chart.chartArea
        if (!area) return chartColors.blue
        const gradient = chart.ctx.createLinearGradient(area.left, 0, area.right, 0)
        gradient.addColorStop(0, chartColors.blue)
        gradient.addColorStop(1, chartColors.green)
        return gradient
      }
    }]
  }
})

const leaderboardChartOptions = computed(() => ({
  ...baseChartOptions,
  indexAxis: 'y',
  scales: {
    x: {
      grid: { color: chartColors.grid, drawBorder: false },
      ticks: { color: chartColors.muted, callback: (value) => formatMetric(value) }
    },
    y: {
      grid: { display: false },
      ticks: {
        color: chartColors.text,
        font: { size: 12, weight: '700' },
        callback(value) {
          const label = this.getLabelForValue(value)
          return label.length > 16 ? `${label.slice(0, 15)}...` : label
        }
      }
    }
  },
  plugins: {
    ...baseChartOptions.plugins,
    tooltip: {
      ...baseChartOptions.plugins.tooltip,
      callbacks: {
        label: (context) => `${rankLabel.value}: ${formatMetric(context.parsed.x)}`
      },
    }
  }
}))

const scatterChartData = computed(() => ({
  datasets: [{
    label: 'Visible markets',
    data: scatterPoints.value.map((point) => ({
      x: point.risk,
      y: point.demand,
      score: point.score,
      marketName: point.name,
      population: point.population
    })),
    backgroundColor: (context) => context.raw?.marketName === leader.value.name ? chartColors.green : chartColors.blue,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    pointRadius: (context) => Math.max(5, Math.min(13, Math.sqrt(context.raw?.population || 100000) / 170)),
    pointHoverRadius: (context) => Math.max(7, Math.min(16, Math.sqrt(context.raw?.population || 100000) / 150))
  }]
}))

const scatterChartOptions = computed(() => ({
  ...baseChartOptions,
  scales: {
    x: {
      min: 0,
      max: 100,
      title: { display: true, text: 'Risk pressure', color: chartColors.muted, font: { weight: '900' } },
      grid: { color: chartColors.grid, drawBorder: false },
      ticks: { color: chartColors.muted }
    },
    y: {
      min: 0,
      max: 100,
      title: { display: true, text: 'Demand strength', color: chartColors.muted, font: { weight: '900' } },
      grid: { color: chartColors.grid, drawBorder: false },
      ticks: { color: chartColors.muted }
    }
  },
  plugins: {
    ...baseChartOptions.plugins,
    annotation: {
      annotations: {
        sweetSpot: {
          type: 'box',
          xMin: 0,
          xMax: 35,
          yMin: 70,
          yMax: 100,
          backgroundColor: 'rgba(125, 220, 106, 0.12)',
          borderColor: 'rgba(125, 220, 106, 0.35)',
          borderWidth: 2,
          drawBehind: true,
          label: {
            display: true,
            content: 'sweet spot',
            color: '#7ddc6a',
            font: { weight: '800', size: 12, family: 'DM Sans' },
            position: 'start'
          }
        }
      }
    },
    tooltip: {
      ...baseChartOptions.plugins.tooltip,
      callbacks: {
        title: (items) => items[0]?.raw?.marketName || '',
        label: (context) => [
          `Demand: ${formatMetric(context.raw.y)}`,
          `Risk: ${formatMetric(context.raw.x)}`,
          `Rank score: ${formatMetric(context.raw.score)}`
        ]
      }
    }
  }
}))

const scatterSummary = computed(() => {
  const points = scatterPoints.value
  if (!points.length) return 'Visible markets'
  const strong = points.filter((point) => point.demand >= 70 && point.risk <= 35).length
  return `${strong} of top ${points.length} cleaner bets`
})

const locationName = (row) => {
  if (store.currentLevel === 'state') return getStateName(row)
  if (store.currentLevel === 'county') return getCountyName(row)
  return row.zcta5 || row.NAME || 'Unknown'
}

const levelLabel = computed(() => {
  if (store.currentLevel === 'state') return 'State scan'
  if (store.currentLevel === 'county') return `${store.currentState} counties`
  return `${store.currentCounty} ZIP codes`
})

const drilldownTitle = computed(() => {
  if (store.currentLevel === 'state') return 'Ranked state markets'
  if (store.currentLevel === 'county') return 'County diligence queue'
  return 'ZIP-level signals'
})

const drilldownHint = computed(() => {
  if (store.currentLevel === 'state') return 'Select a state card to inspect its counties.'
  if (store.currentLevel === 'county') return 'County cards are the diligence layer; ZIP crosswalk data is intentionally excluded from this screen.'
  return 'ZIP-level signals are disabled until regenerated ZCTA files include state and county join keys.'
})

const leader = computed(() => rankedRows.value[0] || { name: 'N/A', value: null })

const summary = computed(() => {
  if (!leader.value?.name || averageValue.value === null) return 'Load a signal to generate a market brief.'
  const delta = ((leader.value.value - averageValue.value) / averageValue.value) * 100
  const direction = delta >= 0 ? 'above' : 'below'
  return `${leader.value.name} is ${Math.abs(delta).toFixed(1)}% ${direction} the visible-market average for ${rankLabel.value.toLowerCase()}. Based on active filters and rank order.`
})

const kpis = computed(() => [
  {
    label: 'Markets visible',
    value: rows.value.length.toLocaleString(),
    note: selectedLens.value === 'all' ? 'current screen, after filters' : `${lensLabel(selectedLens.value)} lens`
  },
  {
    label: 'Average signal',
    value: averageValue.value === null ? 'N/A' : formatMetric(averageValue.value),
    note: `${rankLabel.value} across visible markets`
  },
  {
    label: 'Decision bar',
    value: distribution.value.q3 === null ? 'N/A' : formatMetric(distribution.value.q3),
    note: `upper-quartile cut, ${selectedYearLabel.value}`
  }
])

const rankedRows = computed(() => rows.value
  .map((row) => {
    const value = rankScore(row)
    const name = locationName(row)
    return { raw: row, value, name, id: `${store.currentLevel}:${name}` }
  })
  .filter((row) => Number.isFinite(row.value))
  .filter((row) => !shortlistOnly.value || shortlisted.value.has(row.id))
  .sort((left, right) => right.value - left.value)
  .slice(0, 24)
  .map((row, index) => ({
    ...row,
    rank: index + 1,
    key: `${store.currentLevel}-${rankMode.value}-${row.name}-${index}`,
    intensity: Math.max(4, Math.min(100, ((row.value - minValue.value) / range.value) * 100)),
    factGroups: buildFactGroups(row.raw),
    note: buildNote(row.raw, row.value),
    delta: formatDelta(row.value, averageValue.value),
    deltaTone: row.value >= (averageValue.value || row.value) ? 'positive' : 'negative',
    percentile: percentileLabel(row.value),
    quartileSignal: quartileSignal(row.value),
    signals: buildSignals(row.raw)
  })))

function buildFactGroups(row) {
  return [
    {
      title: 'Demand base',
      facts: [
        { label: 'Population', value: formatMetricValue(row, 'total_population') },
        { label: 'Income', value: formatMetricValue(row, 'median_household_income') },
        { label: 'Median age', value: formatMetricValue(row, 'median_age') },
        { label: 'Housing units', value: formatMetricValue(row, 'total_housing_units') }
      ]
    },
    {
      title: 'Housing economics',
      facts: [
        { label: 'Home value', value: formatMetricValue(row, 'median_home_value') },
        { label: 'Rent', value: formatMetricValue(row, 'median_gross_rent') },
        { label: 'Vacancy', value: formatRate(row, 'housing_vacancy_rate') },
        { label: 'Renter share', value: formatRate(row, 'renter_rate') }
      ]
    }
  ]
}

function rankScore(row, year = store.currentYear) {
  if (rankMode.value === 'selected') return metricNumber(row, metricForYear(rankMetricBase.value, year))
  if (rankMode.value === 'opportunity') return metricNumber(row, metricForYear('market_opportunity_score', year))
  if (rankMode.value === 'affordability') return metricNumber(row, metricForYear('housing_affordability_index', year))
  if (rankMode.value === 'demand') return metricNumber(row, metricForYear('consumer_demand_index', year))
  if (rankMode.value === 'population') return metricNumber(row, metricForYear('total_population', year))
  if (rankMode.value === 'income') return metricNumber(row, metricForYear('median_household_income', year))
  if (rankMode.value === 'tightSupply') return inverseScore(row, 'housing_vacancy_rate', year)
  if (rankMode.value === 'expansion') {
    const growth = metricNumber(row, metricForYear('executive_growth_score', year))
    const demand = metricNumber(row, metricForYear('consumer_demand_index', year))
    const population = metricNumber(row, metricForYear('total_population', year))
    const pressure = metricNumber(row, metricForYear('cost_pressure_index', year))
    if (!Number.isFinite(growth) && !Number.isFinite(demand)) return NaN
    const growthScore = Number.isFinite(growth) ? growth * 1.3 : 0
    const demandScore = Number.isFinite(demand) ? demand * 1.1 : 0
    const popScore = Number.isFinite(population) ? Math.log10(population + 1) * 10 : 0
    const pressureBonus = Number.isFinite(pressure) && pressure <= 35 ? 15 : (Number.isFinite(pressure) && pressure > 60 ? -15 : 0)
    return growthScore + demandScore + popScore + pressureBonus
  }
  if (rankMode.value === 'rental') {
    const yieldValue = metricNumber(row, metricForYear('gross_rental_yield', year))
    const renterRate = metricNumber(row, metricForYear('renter_rate', year))
    const vacancy = metricNumber(row, metricForYear('housing_vacancy_rate', year))
    if (!Number.isFinite(yieldValue)) return NaN
    const yieldScore = Number.isFinite(yieldValue) ? yieldValue * 1.2 : 0
    const renterScore = Number.isFinite(renterRate) ? renterRate * 100 * 0.8 : 0
    const vacancyBonus = Number.isFinite(vacancy) && vacancy <= 0.06 ? 20 : (Number.isFinite(vacancy) && vacancy >= 0.12 ? -15 : 0)
    return yieldScore + renterScore + vacancyBonus
  }
  if (rankMode.value === 'premium') {
    const income = metricNumber(row, metricForYear('median_household_income', year))
    const premium = metricNumber(row, metricForYear('premium_housing_rate', year))
    const affluence = metricNumber(row, metricForYear('affluence_index', year))
    if (!Number.isFinite(income) && !Number.isFinite(premium)) return NaN
    const incomeScore = Number.isFinite(income) ? income * 0.0005 : 0
    const premiumScore = Number.isFinite(premium) ? premium * 100 * 0.7 : 0
    const affluenceScore = Number.isFinite(affluence) ? affluence * 0.5 : 0
    return incomeScore + premiumScore + affluenceScore
  }
  if (rankMode.value === 'risk') {
    const pressure = metricNumber(row, metricForYear('cost_pressure_index', year))
    const vacancy = metricNumber(row, metricForYear('housing_vacancy_rate', year))
    const demand = metricNumber(row, metricForYear('consumer_demand_index', year))
    if (!Number.isFinite(pressure)) return NaN
    const pressureScore = Number.isFinite(pressure) ? pressure * 1.5 : 0
    const vacancyScore = Number.isFinite(vacancy) ? vacancy * 100 * 0.6 : 0
    const demandPenalty = Number.isFinite(demand) && demand <= 50 ? 20 : 0
    return pressureScore + vacancyScore + demandPenalty
  }
  return metricNumber(row, metricForYear(rankMetricBase.value, year))
}

function metricNumber(row, metric) {
  const value = Number.parseFloat(getMetricValue(row, metric))
  return Number.isFinite(value) && value > -999999 ? value : NaN
}

function inverseScore(row, base, year = store.currentYear) {
  const value = metricNumber(row, metricForYear(base, year))
  return Number.isFinite(value) ? -value : NaN
}

function buildNote(row, value) {
  const affordability = Number.parseFloat(getMetricValue(row, metricForYear('housing_affordability_index')))
  const pressure = Number.parseFloat(getMetricValue(row, metricForYear('cost_pressure_index')))
  const demand = Number.parseFloat(getMetricValue(row, metricForYear('consumer_demand_index')))
  const density = Number.parseFloat(getMetricValue(row, metricForYear('population_density')))
  const yieldValue = Number.parseFloat(getMetricValue(row, metricForYear('gross_rental_yield')))
  const vacancy = Number.parseFloat(getMetricValue(row, metricForYear('housing_vacancy_rate')))
  const income = Number.parseFloat(row.median_household_income)
  const population = Number.parseFloat(row.total_population)
  const tone = value >= (distribution.value.q3 || value) ? 'priority' : 'watch'

  if (selectedLens.value === 'expansion') {
    if (Number.isFinite(demand) && demand >= 65 && Number.isFinite(pressure) && pressure <= 35) return variedCopy(row, 'expansionStrong')
    if (Number.isFinite(demand) && demand >= 65) return variedCopy(row, 'expansionDemand')
    if (Number.isFinite(population) && population >= 1000000) return variedCopy(row, 'expansionScale')
    if (Number.isFinite(density) && density >= 500) return variedCopy(row, 'expansionDense')
    return variedCopy(row, 'expansionWatch')
  }

  if (selectedLens.value === 'rental') {
    if (Number.isFinite(yieldValue) && yieldValue >= 6 && Number.isFinite(vacancy) && vacancy <= 0.06) return variedCopy(row, 'rentalTop')
    if (Number.isFinite(yieldValue) && yieldValue >= 5) return variedCopy(row, 'rentalYield')
    if (Number.isFinite(vacancy) && vacancy <= 0.06) return variedCopy(row, 'rentalTight')
    return variedCopy(row, 'rentalWatch')
  }

  if (selectedLens.value === 'luxury') {
    if (Number.isFinite(income) && income >= 100000 && Number.isFinite(demand) && demand >= 60) return variedCopy(row, 'luxuryStrong')
    if (Number.isFinite(income) && income >= 90000) return variedCopy(row, 'luxuryIncome')
    return variedCopy(row, 'luxuryWatch')
  }

  if (selectedLens.value === 'risk') {
    if (Number.isFinite(pressure) && pressure >= 70) return variedCopy(row, 'riskHigh')
    if (Number.isFinite(pressure) && pressure >= 50) return variedCopy(row, 'riskElevated')
    if (Number.isFinite(vacancy) && vacancy >= 0.1) return variedCopy(row, 'riskSupply')
    return variedCopy(row, 'riskManageable')
  }

  if (Number.isFinite(affordability) && affordability >= 70) return variedCopy(row, 'affordable')
  if (tone === 'priority') return variedCopy(row, 'priority')
  return variedCopy(row, 'watch')
}

function buildSignals(row) {
  const signals = []
  const yieldValue = Number.parseFloat(getMetricValue(row, metricForYear('gross_rental_yield')))
  const vacancy = Number.parseFloat(getMetricValue(row, metricForYear('housing_vacancy_rate')))
  const affordability = Number.parseFloat(getMetricValue(row, metricForYear('housing_affordability_index')))
  const demand = Number.parseFloat(getMetricValue(row, metricForYear('consumer_demand_index')))
  const pressure = Number.parseFloat(getMetricValue(row, metricForYear('cost_pressure_index')))
  const density = Number.parseFloat(getMetricValue(row, metricForYear('population_density')))
  const population = Number.parseFloat(row.total_population)
  const income = Number.parseFloat(row.median_household_income)
  const seniorShare = Number.parseFloat(getMetricValue(row, metricForYear('population_65plus_pct')))

  if (Number.isFinite(demand) && demand >= 65) signals.push('Priority diligence')
  if (Number.isFinite(pressure) && pressure >= 70) signals.push('Risk review')
  if (Number.isFinite(income) && income >= 90000) signals.push('Income-supported')
  if ((Number.isFinite(density) && density >= 500) || (Number.isFinite(population) && population >= 1000000)) signals.push('Scaled demand')
  if (Number.isFinite(yieldValue) && yieldValue >= 5) signals.push('Rental yield')
  if (Number.isFinite(vacancy) && vacancy < 0.08) signals.push('Tight supply')
  if (Number.isFinite(affordability) && affordability >= 65) signals.push('Affordable entry')
  if (Number.isFinite(seniorShare) && seniorShare >= 0.18) signals.push('Aging-demand signal')

  return signals.length ? signals.slice(0, 3) : ['Watchlist']
}

function selectLens(lens) {
  const nextLens = selectedLens.value === lens ? '' : lens
  store.dimensionFilters.executivePreset = nextLens
  rankMode.value = nextLens === 'risk' ? 'lowerRisk' : nextLens || 'selected'
}

function isShortlisted(row) {
  return row?.id && shortlisted.value.has(row.id)
}

function toggleShortlist(row) {
  if (!row?.id) return
  const next = new Set(shortlisted.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  shortlisted.value = next
  if (shortlistOnly.value && !next.size) shortlistOnly.value = false
}

function lensLabel(lens) {
  return useCases.find((item) => item.lens === lens)?.title || 'All opportunities'
}

const noteVariants = {
  expansionStrong: [
    'Top expansion pick. Scale, demand, and favorable cost pressure all align.',
    'Strong candidate for next-market review. Demand fundamentals support growth.',
    'This market checks the key boxes for expansion. Prioritize for diligence.'
  ],
  expansionDemand: [
    'Demand is doing real work here. Worth a faster county-level look.',
    'Good expansion candidate: scale and demand both show up.',
    'The demand base is strong enough to keep this near the top of the board.'
  ],
  expansionScale: [
    'Scale market with expansion potential. Population base supports operations.',
    'Large enough for broad expansion plays. Confirm demand per capita.',
    'Market size gives this optionality. Local dynamics need verification.'
  ],
  expansionDense: [
    'Density helps operations, coverage, and repeatable market entry.',
    'This reads like an efficient operating market, not just a large one.',
    'Good footprint logic: enough concentration to make field execution easier.'
  ],
  expansionWatch: [
    'Viable but not urgent. Prove the submarket before spending diligence time.',
    'Interesting enough to track; not a slam dunk without local proof.',
    'A second-pass market unless a strategic reason pushes it forward.'
  ],
  rentalTop: [
    'Best-in-class rental setup. High yield, tight vacancy, strong renter base.',
    'Rental economics are compelling. Operate with confidence after local comps.',
    'Top rental yield candidate with favorable supply dynamics. Diligence priority.'
  ],
  rentalYield: [
    'Positive rental yield screen. Validate vacancy assumptions locally.',
    'Yield potential exists. Confirm operating cost structure before commitment.',
    'Rental story is viable. Supply risk needs closer look on the ground.'
  ],
  rentalTight: [
    'Tight vacancy supports rental pricing power. Demand signals are constructive.',
    'Supply-constrained market favors rental strategy. Local comps will confirm.',
    'Low vacancy is a positive signal for rental positioning.'
  ],
  rentalWatch: [
    'Rental potential exists but needs more scrutiny. Local market needed.',
    'Yield is not the primary story here. Operating dynamics need verification.',
    'Viable rental market but not a top pick. Use as comp set reference.'
  ],
  luxuryStrong: [
    'Premium demand with income support. Pricing power may hold.',
    'Strong luxury segment fundamentals. Validate premium inventory depth.',
    'Upper-income market with demand resilience. Confirm buyer depth locally.'
  ],
  luxuryIncome: [
    'Income support is the story. Validate premium inventory and buyer depth.',
    'Pricing power may exist here, but comps need to confirm it.',
    'Good premium-demand read. Watch affordability before leaning in.'
  ],
  luxuryWatch: [
    'Premium demand not dominant here. Entry price may not justify the play.',
    'Luxury segment is present but not differentiated. Needs sharper thesis.',
    'Premium positioning possible but confirm local competitive set first.'
  ],
  riskHigh: [
    'Elevated cost pressure warrants caution. Underwriting should be conservative.',
    'High risk markers dominate. Red-team review before any capital commitment.',
    'Cost or supply pressure may erode returns. Proceed carefully.'
  ],
  riskElevated: [
    'Above-average risk profile. Stress-test assumptions before proceeding.',
    'Risk factors present but not dominant. Local dynamics could shift the view.',
    'Moderate risk requires careful underwriting. Demand trajectory is key.'
  ],
  riskSupply: [
    'Supply risk is the concern. New inventory could pressure existing players.',
    'Vacancy elevation suggests oversupply risk. Monitor absorption timeline.',
    'Supply-side pressure is real. Validate with permit and delivery data.'
  ],
  riskManageable: [
    'Risk profile is within acceptable range. No major red flags.',
    'Balanced risk posture. Standard underwriting process adequate.',
    'Risk factors are present but not unusual for market conditions.'
  ],
  luxury: [
    'Income support is the story. Validate premium inventory and buyer depth.',
    'Pricing power may exist here, but comps need to confirm it.',
    'Good premium-demand read. Watch affordability before leaning in.'
  ],
  risk: [
    'Risk is the headline. Tighten assumptions before this reaches underwriting.',
    'Proceed carefully: cost or supply pressure can erase the upside.',
    'Good candidate for a red-team review before capital gets serious.'
  ],
  affordable: [
    'Affordability gives this market more room to run.',
    'Household economics look healthier than the typical visible market.',
    'This screen suggests demand may have room to absorb housing costs.'
  ],
  priority: [
    'Above-quartile signal. Put it in the diligence queue.',
    'This is separating from the pack on the selected signal.',
    'Good board-level candidate for a focused second look.'
  ],
  watch: [
    'Track it, but do not force it into the priority list yet.',
    'Useful benchmark market. Needs a sharper thesis to move up.',
    'Keep it visible as a comp until strategy fit is clearer.'
  ]
}

function variedCopy(row, key) {
  const variants = noteVariants[key] || noteVariants.watch
  const name = locationName(row)
  const hash = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), key.length)
  return variants[hash % variants.length]
}

function formatDelta(value, benchmark) {
  if (!Number.isFinite(value) || !Number.isFinite(benchmark) || benchmark === 0) return 'No comp'
  const delta = ((value - benchmark) / benchmark) * 100
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
}

function percentileLabel(value) {
  const values = metricValues.value.slice().sort((left, right) => left - right)
  if (!values.length) return 'No percentile'
  const below = values.filter((item) => item <= value).length
  return `P${Math.round((below / values.length) * 100)}`
}

function quartileSignal(value) {
  const q3 = distribution.value.q3
  const q1 = distribution.value.q1
  if (Number.isFinite(q3) && value >= q3) return 'Upper quartile'
  if (Number.isFinite(q1) && value <= q1) return 'Lower quartile'
  return 'Middle band'
}

function marketPosture(row) {
  const pressure = Number.parseFloat(getMetricValue(row, metricForYear('cost_pressure_index')))
  const vacancy = Number.parseFloat(getMetricValue(row, metricForYear('housing_vacancy_rate')))
  const demand = Number.parseFloat(getMetricValue(row, metricForYear('consumer_demand_index')))
  const growth = Number.parseFloat(getMetricValue(row, metricForYear('executive_growth_score')))
  const income = Number.parseFloat(getMetricValue(row, metricForYear('median_household_income')))
  const population = Number.parseFloat(getMetricValue(row, metricForYear('total_population')))
  const yieldValue = Number.parseFloat(getMetricValue(row, metricForYear('gross_rental_yield')))

  const riskPosture = Number.isFinite(pressure) && pressure >= 40
    ? 'Elevated'
    : Number.isFinite(vacancy) && vacancy >= 0.14
    ? 'Supply watch'
    : 'Manageable'

  let demandPosture = 'Selective'
  if (Number.isFinite(demand) && demand >= 80) demandPosture = 'Deep demand'
  else if (Number.isFinite(income) && income >= 95000) demandPosture = 'Premium demand'
  else if (Number.isFinite(population) && population >= 5000000) demandPosture = 'Scale market'
  else if (Number.isFinite(yieldValue) && yieldValue >= 5.5) demandPosture = 'Rental-led'
  else if (Number.isFinite(growth) && growth >= 41) demandPosture = 'Balanced'

  return {
    riskPosture,
    riskCopy: riskPosture === 'Elevated'
      ? 'Costs can compress returns.'
      : riskPosture === 'Supply watch'
      ? 'Vacancy needs a closer look.'
      : 'No major risk flag dominates.',
    demandPosture,
    demandCopy: {
      'Deep demand': 'Strong scale and spending power.',
      'Premium demand': 'Income supports higher-price strategy.',
      'Scale market': 'Large enough for broad expansion.',
      'Rental-led': 'Yield is the clearest demand angle.',
      Balanced: 'No single demand driver dominates.',
      Selective: 'Needs a sharper local thesis.'
    }[demandPosture]
  }
}

function trendPosture(row) {
  const series = trendYears
    .map((year) => rankScore(row, year))
    .filter(Number.isFinite)
  if (series.length < 2) return { trendPosture: 'No trend', trendCopy: 'Only current-year data is available.' }
  const first = series[0]
  const last = series.at(-1)
  const delta = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100
  if (delta >= 8) return { trendPosture: 'Rising', trendCopy: `Up ${delta.toFixed(1)}% over the visible vintages.` }
  if (delta <= -8) return { trendPosture: 'Cooling', trendCopy: `Down ${Math.abs(delta).toFixed(1)}% over the visible vintages.` }
  return { trendPosture: 'Stable', trendCopy: `Changed ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% over the visible vintages.` }
}

function buildModalMarket(row) {
  const posture = marketPosture(row.raw)
  const trend = trendPosture(row.raw)
  const facts = Object.fromEntries(row.factGroups.flatMap((group) => group.facts).map((fact) => [fact.label, fact.value]))
  const pressure = formatMetricValue(row.raw, 'cost_pressure_index')
  const vacancy = facts.Vacancy
  const rentalYield = formatRate(row.raw, 'gross_rental_yield')
  const demand = Number.parseFloat(getMetricValue(row.raw, metricForYear('consumer_demand_index')))
  const income = Number.parseFloat(row.raw.median_household_income)
  const yieldValue = Number.parseFloat(getMetricValue(row.raw, metricForYear('gross_rental_yield')))
  const growth = Number.parseFloat(getMetricValue(row.raw, metricForYear('executive_growth_score')))

  const lensInsight = getLensInsight(row, posture, demand, income, yieldValue, pressure, growth)
  const lensNextSteps = getLensNextSteps(row, posture, demand, income, yieldValue, pressure)

  return {
    ...row,
    ...posture,
    ...trend,
    lensInsight,
    modalSummary: `#${row.rank} by ${rankLabel.value.toLowerCase()} in the current screen.`,
    insights: [
      { label: 'Demand profile', value: posture.demandPosture, note: `${facts.Population} people, ${facts.Income} median income.` },
      { label: 'Unit economics', value: rentalYield, note: `${facts.Rent} rent vs ${facts['Home value']} entry price.` },
      { label: 'Risk flag', value: posture.riskPosture, note: `${vacancy} vacancy; ${pressure} cost pressure index.` },
      { label: 'Momentum', value: trend.trendPosture, note: trend.trendCopy },
      { label: 'Demographics', value: facts['Median age'], note: `${facts['Renter share']} renter share shapes product strategy.` },
      { label: 'Lens read', value: lensInsight.headline, note: lensInsight.detail }
    ],
    nextSteps: lensNextSteps
  }
}

function getLensInsight(row, posture, demand, income, yieldValue, pressure, growth) {
  if (selectedLens.value === 'expansion') {
    if (Number.isFinite(demand) && demand >= 65 && Number.isFinite(pressure) && pressure <= 35) {
      return { headline: 'Expansion-ready', detail: 'Strong demand with controlled cost pressure. Growth indicators support market entry.' }
    }
    if (Number.isFinite(growth) && growth >= 45) {
      return { headline: 'High-growth market', detail: 'Executive growth score is elevated. Verify with local permit data.' }
    }
    if (Number.isFinite(demand) && demand >= 55) {
      return { headline: 'Positive demand', detail: 'Demand signals are constructive. Local comps needed to validate.' }
    }
    return { headline: 'Selective entry', detail: 'Demand is present but not dominant. Strategic rationale needed.' }
  }
  if (selectedLens.value === 'rental') {
    if (Number.isFinite(yieldValue) && yieldValue >= 6 && posture.riskPosture === 'Manageable') {
      return { headline: 'Top rental pick', detail: 'Yield exceeds 6% with manageable risk. Validate vacancy assumptions.' }
    }
    if (Number.isFinite(yieldValue) && yieldValue >= 5) {
      return { headline: 'Viable rental', detail: 'Positive yield screen. Operating cost structure needs local verification.' }
    }
    return { headline: 'Yield-challenged', detail: 'Rental economics are thin. Entry price may not support the play.' }
  }
  if (selectedLens.value === 'luxury') {
    if (Number.isFinite(income) && income >= 100000 && Number.isFinite(demand) && demand >= 55) {
      return { headline: 'Premium market', detail: 'High income with demand support. Validate premium segment depth locally.' }
    }
    if (Number.isFinite(income) && income >= 90000) {
      return { headline: 'Income-supported', detail: 'Purchasing power exists. Confirm buyer depth and affordability headroom.' }
    }
    return { headline: 'Selective premium', detail: 'Premium positioning possible but requires sharper local thesis.' }
  }
  if (selectedLens.value === 'risk') {
    if (posture.riskPosture === 'Elevated') {
      return { headline: 'High risk', detail: 'Cost pressure is elevated. Underwriting should be conservative. Red-team review advised.' }
    }
    if (posture.riskPosture === 'Supply watch') {
      return { headline: 'Supply risk', detail: 'Vacancy is elevated. New supply could pressure existing players.' }
    }
    return { headline: 'Risk manageable', detail: 'No major red flags. Standard underwriting process adequate.' }
  }
  return { headline: row.quartileSignal, detail: 'Based on current lens and rank settings.' }
}

function getLensNextSteps(_row, _posture, _demand, _income, _yieldValue, _pressure) {
  if (selectedLens.value === 'expansion') {
    return [
      'Validate demand with local research',
      'Confirm operating cost assumptions',
      store.currentLevel === 'state' ? 'Drill into counties' : 'Proceed with parcel analysis'
    ]
  }
  if (selectedLens.value === 'rental') {
    return [
      'Verify vacancy with local broker',
      'Model operating expenses',
      'Assess supply pipeline risk'
    ]
  }
  if (selectedLens.value === 'luxury') {
    return [
      'Confirm premium buyer depth',
      'Validate pricing power vs comps',
      'Check affordability headroom'
    ]
  }
  if (selectedLens.value === 'risk') {
    return [
      'Stress-test return assumptions',
      'Review supply pipeline',
      'Confirm demand trajectory'
    ]
  }
  return [
    'Validate with local comps',
    'Check permits and supply',
    store.currentLevel === 'state' ? 'Drill counties' : 'Pair with parcel data'
  ]
}

function metricForYear(base, year = store.currentYear) {
  if (!base) return base
  if (String(base).match(/_\d{4}$/)) return base
  return year ? `${base}_${year}` : base
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') return 'N/A'
  return formatValue(value)
}

function formatMetricValue(row, base) {
  return formatMetric(getMetricValue(row, metricForYear(base)) ?? row[base])
}

function formatRate(row, base) {
  const raw = Number.parseFloat(getMetricValue(row, metricForYear(base)) ?? row[base])
  if (!Number.isFinite(raw)) return 'N/A'
  const normalized = Math.abs(raw) <= 1 ? raw * 100 : raw
  return `${normalized.toFixed(1)}%`
}

async function drill(row) {
  if (store.currentLevel === 'state') {
    await store.drillToState(getStateName(row))
  }
}

async function drillToCounty(row) {
  if (store.currentLevel === 'state') {
    await store.drillToState(getStateName(row.raw))
  }
}

async function drillToZcta(row) {
  if (store.currentLevel === 'county') {
    await store.drillToCounty(getCountyName(row.raw))
  }
}

function openMarket(row) {
  selectedMarket.value = buildModalMarket(row)
}
</script>

<style scoped>
.market-explorer {
  display: grid;
  gap: clamp(0.9rem, 1vw, 1.2rem);
}

.use-case-band,
.drilldown-shell {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow);
}

.use-case-band {
  display: grid;
  grid-template-columns: minmax(280px, 0.85fr) minmax(0, 1.25fr) minmax(260px, 0.8fr);
  gap: clamp(1rem, 2vw, 2rem);
  padding: clamp(1rem, 1.5vw, 1.4rem);
  align-items: start;
}

.use-case-band--collapsed {
  grid-template-columns: 1fr;
  padding-block: 0.85rem;
}

.briefing-title-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
}

.collapse-briefing {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 34px;
  padding: 0 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 800;
  white-space: nowrap;
}

.collapse-briefing:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.collapse-briefing svg {
  transition: transform var(--duration-fast);
}

.collapse-briefing svg.rotated {
  transform: rotate(-90deg);
}

.use-case-copy h2,
.drilldown-header h2 {
  margin: 0.2rem 0 0.45rem;
  color: var(--text-primary);
  font-size: clamp(1.25rem, 1vw + 1rem, 1.8rem);
  line-height: 1.15;
}

.use-case-copy p,
.drilldown-header p,
.use-case-card p,
.insight-card p,
.market-note {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.45;
}

.section-eyebrow,
.card-label,
.rank {
  color: var(--accent-green);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.use-case-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.use-case-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  padding: 0.9rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  color: inherit;
  cursor: pointer;
}

.use-case-card:hover,
.use-case-card.active {
  border-color: var(--accent-green);
  background: rgb(var(--accent-green-rgb), 0.08);
}

.use-case-card svg {
  color: var(--accent-blue);
}

.use-case-card.active svg {
  color: var(--accent-green);
}

.use-case-card h3,
.market-card h3 {
  margin: 0 0 0.25rem;
  color: var(--text-primary);
  font-size: 1rem;
}

.quick-help-panel {
  align-self: stretch;
  display: grid;
  gap: 0.7rem;
  padding: 0.9rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgb(var(--accent-blue-rgb), 0.08), transparent 65%), var(--bg-surface);
}

.quick-help-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 900;
  text-align: left;
}

.quick-help-toggle svg {
  color: var(--accent-blue);
}

.quick-help-body {
  display: grid;
  gap: 0.65rem;
}

.quick-help-body strong {
  display: block;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.quick-help-body p {
  margin: 0.15rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.market-empty {
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  padding: 4rem 1rem;
  color: var(--text-secondary);
  text-align: center;
}

.market-empty svg {
  color: var(--accent-green);
}

.market-empty h3 {
  margin: 0;
  color: var(--text-primary);
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.insight-card {
  padding: var(--spacing-card-padding);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  box-shadow: var(--shadow);
}

.insight-card--lead {
  background: linear-gradient(135deg, rgb(var(--accent-green-rgb), 0.14), transparent 72%), var(--bg-surface);
}

.insight-card h3 {
  margin: 0.35rem 0;
  color: var(--text-primary);
  font-size: clamp(1rem, 1.5vw + 0.5rem, 1.4rem);
}

.insight-card strong {
  display: block;
  margin: 0.25rem 0 0.5rem;
  color: var(--text-primary);
  font-size: clamp(1.1rem, 1.5vw + 0.5rem, 1.6rem);
  font-variant-numeric: tabular-nums;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.chart-canvas-frame {
  position: relative;
  width: 100%;
  height: 220px;
  overflow: hidden;
}

.chart-card {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  box-shadow: var(--shadow);
}

.chart-card header {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
  margin-bottom: 0.7rem;
}

.chart-card header span,
.chart-foot {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chart-card header strong {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  text-align: right;
}

.chart-canvas-frame {
  position: relative;
  width: 100%;
  height: 230px;
  overflow: hidden;
}

.market-chart {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.market-chart--bars,
.market-chart--scatter {
  height: 250px;
}

.chart-foot {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  margin-top: 0.4rem;
}

.chart-foot b {
  color: var(--accent-green);
  font-size: var(--font-size-xs);
  text-transform: none;
  letter-spacing: 0;
  text-align: center;
}

.drilldown-shell {
  padding: clamp(1rem, 1.4vw, 1.35rem);
}

.drilldown-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.drilldown-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.rank-control {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 36px;
  padding: 0 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}

.rank-control span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
}

.rank-control select {
  max-width: 180px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-weight: 800;
}

.rank-control select:focus {
  outline: none;
}

.rank-control select option {
  background: var(--bg-card);
  color: var(--text-primary);
}

.rank-control select option:checked {
  background: var(--accent-blue);
  color: var(--text-on-accent);
}

.ghost-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 36px;
  padding: 0 0.8rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 700;
}

.ghost-button:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.ghost-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ghost-button.active {
  border-color: var(--accent-green);
  background: rgb(var(--accent-green-rgb), 0.1);
  color: var(--accent-green);
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.8rem;
}

.market-card {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  transition: transform var(--duration-fast), border-color var(--duration-fast), box-shadow var(--duration-fast);
}

.market-card--clickable {
  cursor: pointer;
}

.market-card--clickable:hover,
.market-card:focus-visible {
  outline: none;
  transform: translateY(-2px);
  border-color: var(--accent-green);
  box-shadow: var(--shadow-lg);
}

.market-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.score {
  color: var(--accent-green);
  font-weight: 800;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.score-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.delta-chip {
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 800;
  background: var(--bg-elevated);
}

.delta-chip.positive {
  color: var(--color-success);
}

.delta-chip.negative {
  color: var(--color-error);
}

.comparison-row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.signal-meter {
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
}

.signal-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-green));
}

.fact-groups {
  display: grid;
  gap: 0.7rem;
}

.fact-group {
  display: grid;
  gap: 0.45rem;
}

.fact-group h4 {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.fact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
  margin: 0;
}

.fact-grid div {
  padding: 0.6rem;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

.fact-grid dt {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.fact-grid dd {
  margin: 0.15rem 0 0;
  color: var(--text-primary);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.thesis-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.thesis-pill {
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-full);
  background: rgb(var(--accent-blue-rgb), 0.12);
  color: var(--accent-blue);
  font-size: var(--font-size-xs);
  font-weight: 800;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.details-link,
.shortlist-button,
.drilldown-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 34px;
  padding: 0 0.7rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-weight: 800;
  font-size: var(--font-size-sm);
}

.shortlist-button {
  flex: 1;
  min-width: 80px;
}

.drilldown-button {
  background: rgb(var(--accent-green-rgb), 0.08);
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.drilldown-button:hover {
  background: rgb(var(--accent-green-rgb), 0.15);
}

.details-link:hover,

.details-link:hover,
.shortlist-button:hover,
.shortlist-button.active {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.shortlist-button.active {
  background: rgb(var(--accent-green-rgb), 0.1);
}

.market-modal {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2rem);
  background: rgb(0 0 0 / 62%);
  backdrop-filter: blur(10px);
}

.market-modal-panel {
  width: min(920px, 100%);
  max-height: min(88vh, 900px);
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  box-shadow: var(--shadow-xl);
  padding: clamp(1rem, 2vw, 1.5rem);
}

.market-modal-header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.market-modal-header h2 {
  margin: 0.25rem 0;
  color: var(--text-primary);
  font-size: clamp(1.5rem, 2vw + 0.75rem, 2rem);
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.market-modal-header .section-eyebrow {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent-green);
}

.market-modal-header p {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-md);
}

.modal-close {
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  cursor: pointer;
}

.modal-close:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
}

.modal-score-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.modal-score-grid article,
.modal-insight {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  padding: 1rem;
}

.modal-score-grid span {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.modal-score-grid strong {
  display: block;
  margin: 0.35rem 0 0.25rem;
  color: var(--text-primary);
  font-size: clamp(1.1rem, 1.5vw + 0.5rem, 1.35rem);
  font-weight: 800;
  font-family: var(--font-display);
  font-variant-numeric: tabular-nums;
}

.modal-score-grid p {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  margin: 0;
}

.modal-score-grid article,
.modal-insight {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  padding: 1rem;
}

.modal-score-grid span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.modal-score-grid strong {
  display: block;
  margin: 0.3rem 0;
  color: var(--text-primary);
  font-size: 1.45rem;
}

.modal-score-grid p,
.modal-insight p {
  color: var(--text-secondary);
  line-height: 1.45;
  margin: 0;
}

.modal-insight-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.modal-insight span {
  color: var(--text-tertiary);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.modal-insight strong {
  display: block;
  margin: 0.35rem 0 0.25rem;
  color: var(--text-primary);
  font-size: clamp(0.95rem, 1vw + 0.4rem, 1.15rem);
  font-weight: 700;
  font-family: var(--font-display);
}

.modal-insight p {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  margin: 0;
}

.modal-next-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1rem;
}

.modal-next-strip span {
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-full);
  background: rgb(var(--accent-green-rgb), 0.12);
  color: var(--accent-green);
  font-size: var(--font-size-sm);
  font-weight: 900;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 38px;
  padding: 0 0.9rem;
  border: 1px solid var(--accent-green);
  border-radius: var(--radius-md);
  background: var(--accent-green);
  color: var(--text-on-accent);
  cursor: pointer;
  font-weight: 900;
}

@media (max-width: 1400px) {
  .insight-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 1180px) {
  .chart-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .chart-grid .chart-card:last-child {
    grid-column: span 2;
  }
}

@media (max-width: 1024px) {
  .use-case-band {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .use-case-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .quick-help-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .insight-grid {
    grid-template-columns: 1fr;
  }

  .insight-card--lead {
    order: -1;
  }

  .chart-grid {
    grid-template-columns: 1fr;
  }

  .chart-grid .chart-card:last-child {
    grid-column: auto;
  }

  .market-grid {
    grid-template-columns: 1fr;
  }

  .modal-score-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .modal-insight-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .market-explorer {
    gap: 0.75rem;
  }

  .insight-card {
    padding: 0.875rem;
  }

  .chart-card {
    padding: 0.875rem;
  }

  .chart-canvas-frame {
    height: 180px;
  }

  .market-card {
    padding: 0.875rem;
  }

  .drilldown-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .drilldown-actions {
    flex-wrap: wrap;
    width: 100%;
  }

  .modal-score-grid,
  .modal-insight-grid {
    grid-template-columns: 1fr;
  }
}
</style>
