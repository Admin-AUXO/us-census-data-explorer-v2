<template>
  <div class="help-panel show" @click.self="$emit('close')">
    <div class="help-content">
      <div class="help-header">
        <h2>Quick Read</h2>
        <button class="btn-close-help" @click="$emit('close')">×</button>
      </div>
      <div class="help-body">
        <div class="help-cards">
          <div class="help-card">
            <h3>Start Here</h3>
            <ol>
              <li>Pick a <strong>Strategy lens</strong>. That gets you 80% of the way there.</li>
              <li>Use <strong>Board Question</strong> when you want a different ranking logic.</li>
              <li>Use filters only when the shortlist is too broad.</li>
              <li>Open a card when the market feels worth a real conversation.</li>
            </ol>
          </div>
          <div class="help-card">
            <h3>Read A Card</h3>
            <ul>
              <li><strong>Rank:</strong> where it sits in the current screen.</li>
              <li><strong>Demand base:</strong> population, income, age, and housing units.</li>
              <li><strong>Housing economics:</strong> value, rent, vacancy, and renter share.</li>
              <li><strong>Badges:</strong> quick calls like Rental yield or Tight supply.</li>
            </ul>
          </div>
          <div class="help-card">
            <h3>Use The Charts</h3>
            <ul>
              <li><strong>Momentum:</strong> seven-year direction for the top market.</li>
              <li><strong>Leaderboard:</strong> the top markets under the selected ranking.</li>
              <li><strong>Demand vs risk:</strong> look for high demand with lower pressure.</li>
              <li><strong>County drilldown:</strong> use it after a state passes the sniff test.</li>
            </ul>
          </div>
          <div class="help-card">
            <h3>Keep It Honest</h3>
            <ul>
              <li><strong>Source:</strong> ACS 5-year Census data with derived real-estate signals.</li>
              <li><strong>Use it for:</strong> screening and prioritizing markets.</li>
              <li><strong>Do not use it for:</strong> final underwriting by itself.</li>
              <li><strong>Next proof:</strong> comps, permits, taxes, insurance, and broker checks.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['close'])
</script>

<style scoped>
.help-panel {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: var(--overlay-bg) !important;
  backdrop-filter: blur(var(--blur-sm)) !important;
  z-index: var(--z-index-modal) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: var(--spacing-lg) !important;
  animation: fadeIn var(--duration-normal) var(--easing-standard) !important;
}

.help-panel.show {
  opacity: 1 !important;
  pointer-events: auto !important;
}

.help-content {
  background: var(--bg-card) !important;
  border-radius: var(--radius-xl) !important;
  border: var(--border-width-sm) solid var(--border-color) !important;
  box-shadow: var(--shadow-xl) !important;
  max-width: 42rem !important;
  width: 100% !important;
  max-height: 90vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  animation: slideUp var(--duration-normal) var(--easing-standard) !important;
}

.help-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: var(--spacing-lg) var(--spacing-xl) !important;
  border-bottom: var(--border-width-sm) solid var(--border-color) !important;
  background: var(--bg-elevated) !important;
}

.help-header h2 {
  font-size: var(--font-size-2xl) !important;
  font-weight: var(--font-weight-bold) !important;
  color: var(--text-primary) !important;
  margin: 0 !important;
  font-family: var(--font-body) !important;
}

.btn-close-help {
  width: var(--size-icon-2xl) !important;
  height: var(--size-icon-2xl) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: transparent !important;
  border: var(--border-width-sm) solid var(--border-color) !important;
  border-radius: var(--radius-full) !important;
  color: var(--text-secondary) !important;
  font-size: var(--font-size-2xl) !important;
  line-height: 1 !important;
  cursor: pointer !important;
  transition: all var(--duration-fast) var(--easing-standard) !important;
  padding: 0 !important;
  margin: 0 !important;
}

.btn-close-help:hover {
  background: var(--bg-elevated) !important;
  border-color: var(--accent-green) !important;
  color: var(--accent-green) !important;
  transform: rotate(90deg) !important;
}

.btn-close-help:active {
  transform: rotate(90deg) scale(0.95) !important;
}

.help-body {
  padding: var(--spacing-xl) !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  flex: 1 !important;
  scrollbar-width: thin !important;
  scrollbar-color: var(--border-color) transparent !important;
}

.help-body::-webkit-scrollbar {
  width: var(--spacing-xs) !important;
}

.help-body::-webkit-scrollbar-track {
  background: transparent !important;
}

.help-body::-webkit-scrollbar-thumb {
  background: var(--border-color) !important;
  border-radius: var(--radius-full) !important;
}

.help-body::-webkit-scrollbar-thumb:hover {
  background: var(--border-color-light) !important;
}

.help-cards {
  display: grid !important;
  grid-template-columns: repeat(2, 1fr) !important;
  gap: var(--spacing-lg) !important;
  width: 100% !important;
}

.help-card {
  background: var(--bg-elevated) !important;
  border: var(--border-width-sm) solid var(--border-color) !important;
  border-radius: var(--radius-lg) !important;
  padding: var(--spacing-lg) !important;
  display: flex !important;
  flex-direction: column !important;
  transition: all var(--duration-fast) var(--easing-standard) !important;
}

.help-card:hover {
  border-color: var(--accent-green) !important;
  box-shadow: var(--shadow-accent-sm) !important;
  transform: translateY(-2px) !important;
}

.help-card h3 {
  font-size: var(--font-size-lg) !important;
  font-weight: var(--font-weight-semibold) !important;
  color: var(--accent-green) !important;
  margin-bottom: var(--spacing-md) !important;
  margin-top: 0 !important;
  font-family: var(--font-body) !important;
  display: flex !important;
  align-items: center !important;
  gap: var(--spacing-sm) !important;
}

.help-card h3::before {
  content: '' !important;
  width: var(--spacing-xs) !important;
  height: var(--spacing-md) !important;
  background: var(--accent-green) !important;
  border-radius: var(--radius-sm) !important;
  flex-shrink: 0 !important;
}

.help-card ol,
.help-card ul {
  list-style: none !important;
  padding: 0 !important;
  margin: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: var(--spacing-sm) !important;
  flex: 1 !important;
}

.help-card ol li,
.help-card ul li {
  padding-left: var(--spacing-lg) !important;
  position: relative !important;
  color: var(--text-secondary) !important;
  font-size: var(--font-size-base) !important;
  line-height: 1.6 !important;
  font-family: var(--font-body) !important;
}

.help-card ol li::before {
  content: counter(list-item) !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  color: var(--accent-green) !important;
  font-weight: var(--font-weight-semibold) !important;
  font-size: var(--font-size-sm) !important;
  width: var(--spacing-md) !important;
  height: var(--spacing-md) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: var(--accent-green-opacity-10) !important;
  border-radius: var(--radius-sm) !important;
}

.help-card ul li::before {
  content: '•' !important;
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  color: var(--accent-green) !important;
  font-weight: var(--font-weight-bold) !important;
  font-size: var(--font-size-lg) !important;
}

.help-card ol {
  counter-reset: list-item !important;
}

.help-card ol li {
  counter-increment: list-item !important;
}

.help-card strong {
  color: var(--text-primary) !important;
  font-weight: var(--font-weight-semibold) !important;
}

@media (max-width: 768px) {
  .help-content {
    max-width: 100% !important;
    max-height: 95vh !important;
    border-radius: var(--radius-lg) !important;
  }

  .help-header {
    padding: var(--spacing-md) var(--spacing-lg) !important;
  }

  .help-header h2 {
    font-size: var(--font-size-xl) !important;
  }

  .help-body {
    padding: var(--spacing-lg) !important;
  }

  .help-cards {
    grid-template-columns: 1fr !important;
    gap: var(--spacing-md) !important;
  }

  .help-card {
    padding: var(--spacing-md) !important;
  }

  .help-card h3 {
    font-size: var(--font-size-md) !important;
  }

  .help-card ol li,
  .help-card ul li {
    font-size: var(--font-size-sm) !important;
  }
}
</style>
