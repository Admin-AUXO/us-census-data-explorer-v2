import { ref } from 'vue'
import { useCensusStore } from '../stores/census'
import { formatValue } from '../utils/formatUtils'

const recentExports = ref([])

const escapeHTML = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const useExport = () => {
  const store = useCensusStore()

  const addToRecentExports = (exportRecord) => {
    recentExports.value = [
      { ...exportRecord, timestamp: new Date() },
      ...recentExports.value.slice(0, 4)
    ]
  }

  const getExportMetadata = () => {
    const filters = store.dimensionFilters
    const activeFilters = []

    if (filters.selectedStates?.length > 0 && filters.selectedStates.length < 50) {
      activeFilters.push(`States: ${filters.selectedStates.length} selected`)
    }
    if (filters.selectedRegions?.length > 0) {
      activeFilters.push(`Regions: ${filters.selectedRegions.join(', ')}`)
    }
    if (filters.selectedDivisions?.length > 0) {
      activeFilters.push(`Divisions: ${filters.selectedDivisions.join(', ')}`)
    }
    if (filters.selectedUrbanRural?.length > 0) {
      activeFilters.push(`Urban/Rural: ${filters.selectedUrbanRural.join(', ')}`)
    }
    if (filters.areaMin || filters.areaMax) {
      activeFilters.push(`Area: ${filters.areaMin || 0} - ${filters.areaMax || '∞'} km²`)
    }
    if (filters.metricValueMin || filters.metricValueMax) {
      activeFilters.push(`Value: ${filters.metricValueMin || 0} - ${filters.metricValueMax || '∞'}`)
    }
    if (store.searchQuery) {
      activeFilters.push(`Search: "${store.searchQuery}"`)
    }

    return {
      exportDate: new Date().toISOString(),
      exportDateFormatted: new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      locationContext: store.breadcrumb,
      level: store.currentLevel,
      dataset: store.currentDataset,
      year: store.currentYear,
      metric: store.currentMetric,
      metricLabel: store.currentMetric?.replace(/_\d{4}$/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      filtersApplied: activeFilters,
      compareYear: store.compareYear,
      totalRows: store.filteredData?.length || 0
    }
  }

  const exportToCSV = (data, filename, options = {}) => {
    const { includeMetadata = false, selectedColumns = null } = options

    if (!data || data.length === 0) {
      throw new Error('No data to export')
    }

    let csvContent = ''

    if (includeMetadata) {
      const meta = getExportMetadata()
      csvContent += '# US Census Data Explorer Export\n'
      csvContent += `# Export Date: ${meta.exportDateFormatted}\n`
      csvContent += `# Location: ${meta.locationContext}\n`
      csvContent += `# Level: ${meta.level}\n`
      csvContent += `# Dataset: ${meta.dataset}\n`
      csvContent += `# Year: ${meta.year}\n`
      csvContent += `# Metric: ${meta.metricLabel}\n`
      if (meta.compareYear) {
        csvContent += `# Compare Year: ${meta.compareYear}\n`
      }
      if (meta.filtersApplied.length > 0) {
        csvContent += `# Active Filters:\n`
        meta.filtersApplied.forEach(f => {
          csvContent += `#   - ${f}\n`
        })
      }
      csvContent += `# Total Rows: ${meta.totalRows}\n`
      csvContent += '\n'
    }

    const headers = selectedColumns || Object.keys(data[0])
    csvContent += headers.join(',') + '\n'

    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header]
        if (value == null) value = ''
        if (typeof value === 'string') {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            value = `"${value.replace(/"/g, '""')}"`
          }
        }
        return value
      })
      csvContent += values.join(',') + '\n'
    })

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)

    addToRecentExports({
      type: 'CSV',
      filename: filename,
      rowCount: data.length,
      format: 'csv'
    })

    return true
  }

  const exportToJSON = (data, filename, options = {}) => {
    const { includeMetadata = false, selectedColumns = null } = options

    if (!data || data.length === 0) {
      throw new Error('No data to export')
    }

    const exportData = {
      ...(includeMetadata && { metadata: getExportMetadata() }),
      data: selectedColumns
        ? data.map(row => {
            const filtered = {}
            selectedColumns.forEach(col => {
              filtered[col] = row[col]
            })
            return filtered
          })
        : data
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`)

    addToRecentExports({
      type: 'JSON',
      filename: filename,
      rowCount: data.length,
      format: 'json'
    })

    return true
  }

  const exportToPDF = (reportData, filename) => {
    const htmlContent = generateReportHTML(reportData)

    const blob = new Blob([htmlContent], { type: 'text/html' })
    downloadBlob(blob, filename.endsWith('.html') ? filename : `${filename}.html`)

    addToRecentExports({
      type: 'PDF (HTML)',
      filename: filename,
      rowCount: reportData?.data?.length || 0,
      format: 'pdf'
    })

    return true
  }

  const generateReportHTML = (reportData = {}) => {
    const meta = getExportMetadata()
    const {
      title = 'US Census Data Explorer Report',
      data = [],
      summary = null,
      kpis = null
    } = reportData

    const dataRows = data.slice(0, 100)
    const hasMoreRows = data.length > 100
    const reportTitle = escapeHTML(title)
    const locationContext = escapeHTML(meta.locationContext || 'N/A')
    const exportDateFormatted = escapeHTML(meta.exportDateFormatted)
    const dataset = escapeHTML(meta.dataset || 'N/A')
    const year = escapeHTML(meta.year || 'N/A')
    const compareYear = meta.compareYear ? ` vs ${escapeHTML(meta.compareYear)}` : ''
    const metricLabel = escapeHTML(meta.metricLabel || 'N/A')
    const level = escapeHTML(meta.level === 'zcta5' ? 'ZIP Code' : meta.level.charAt(0).toUpperCase() + meta.level.slice(1))
    const totalRows = escapeHTML(meta.totalRows.toLocaleString())
    const exportedRows = escapeHTML(data.length.toLocaleString())
    const filtersApplied = meta.filtersApplied.map(filter => escapeHTML(filter)).join(' | ')

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle}</title>
  <style>
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .no-print { display: none !important; }
      @page { margin: 0.5in; size: letter; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a2e;
      background: #fff;
      padding: 0.5in;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #a3e635;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    .header-left h1 {
      font-size: 20pt;
      font-weight: 700;
      color: #1a1a2e;
      margin-bottom: 0.25rem;
    }
    .header-left .subtitle {
      font-size: 10pt;
      color: #64748b;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #64748b;
    }
    .header-right .date {
      font-weight: 600;
      color: #1a1a2e;
    }
    .meta-info {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 9pt;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.125rem; }
    .meta-value { font-weight: 600; color: #1a1a2e; }
    .filters-list { font-size: 8pt; color: #475569; margin-top: 0.25rem; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
    }
    .kpi-value { font-size: 18pt; font-weight: 700; color: #a3e635; }
    .kpi-label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 0.25rem; }
    .summary-section {
      background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
      border-left: 4px solid #a3e635;
      padding: 1rem;
      margin-bottom: 1.5rem;
      font-size: 10pt;
    }
    .summary-title { font-weight: 600; margin-bottom: 0.5rem; color: #1a1a2e; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .data-table th {
      background: #1a1a2e;
      color: #fff;
      padding: 0.625rem;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 8pt;
      letter-spacing: 0.5px;
    }
    .data-table td {
      padding: 0.5rem 0.625rem;
      border-bottom: 1px solid #e2e8f0;
    }
    .data-table tr:nth-child(even) { background: #f8fafc; }
    .data-table tr:hover { background: #f0fdf4; }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #64748b;
      text-align: center;
    }
    .footer .source { font-weight: 600; color: #475569; }
    .more-indicator {
      text-align: center;
      padding: 0.5rem;
      color: #64748b;
      font-size: 9pt;
      font-style: italic;
    }
    .btn-print {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: #a3e635;
      color: #1a1a2e;
      border: none;
      border-radius: 6px;
      font-size: 10pt;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 1rem;
    }
    .btn-print:hover { background: #84cc16; }
  </style>
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">Print / Save as PDF</button>

  <div class="header">
    <div class="header-left">
      <h1>${reportTitle}</h1>
      <div class="subtitle">US Census ACS 5-Year Estimates Data Explorer</div>
    </div>
    <div class="header-right">
      <div class="date">${exportDateFormatted}</div>
      <div>${locationContext}</div>
    </div>
  </div>

  <div class="meta-info">
    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Dataset</span>
        <span class="meta-value">${dataset}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Year</span>
        <span class="meta-value">${year}${compareYear}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Metric</span>
        <span class="meta-value">${metricLabel}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Level</span>
        <span class="meta-value">${level}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Total Rows</span>
        <span class="meta-value">${totalRows}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Rows Exported</span>
        <span class="meta-value">${exportedRows}</span>
      </div>
    </div>
    ${meta.filtersApplied.length > 0 ? `
    <div class="filters-list">
      <strong>Active Filters:</strong> ${filtersApplied}
    </div>
    ` : ''}
  </div>

  ${kpis ? `
  <div class="kpi-grid">
    ${kpis.map(kpi => `
      <div class="kpi-card">
        <div class="kpi-value">${escapeHTML(kpi.value)}</div>
        <div class="kpi-label">${escapeHTML(kpi.label)}</div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  ${summary ? `
  <div class="summary-section">
    <div class="summary-title">Executive Summary</div>
    <p>${escapeHTML(summary)}</p>
  </div>
  ` : ''}

  ${dataRows.length > 0 ? `
  <table class="data-table">
    <thead>
      <tr>
        ${Object.keys(dataRows[0]).map(key => `<th>${escapeHTML(formatColumnHeader(key))}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${dataRows.map(row => `
        <tr>
          ${Object.values(row).map(val => `<td>${escapeHTML(val != null ? formatValue(val) : 'N/A')}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody>
  </table>
  ${hasMoreRows ? `<div class="more-indicator">Showing first 100 of ${exportedRows} rows</div>` : ''}
  ` : '<p>No data available for export.</p>'}

  <div class="footer">
    <div class="source">Data Source: US Census Bureau ACS 5-Year Estimates</div>
    <div>Generated by US Census Data Explorer | ${exportDateFormatted}</div>
  </div>
</body>
</html>`
  }

  const formatColumnHeader = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  }

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getKPIs = (data) => {
    if (!data || data.length === 0) return null

    const metric = store.currentMetric
    if (!metric) return null

    const values = data.map(row => parseFloat(row[metric])).filter(v => !isNaN(v))

    if (values.length === 0) return null

    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const min = Math.min(...values)
    const max = Math.max(...values)

    return [
      { label: 'Total Locations', value: data.length.toLocaleString() },
      { label: 'National Average', value: formatValue(avg) },
      { label: 'Minimum', value: formatValue(min) },
      { label: 'Maximum', value: formatValue(max) }
    ]
  }

  const generateSummary = (data) => {
    if (!data || data.length === 0) return 'No data available for analysis.'

    const metric = store.currentMetric
    const level = store.currentLevel
    const location = store.breadcrumb

    const values = data.map(row => parseFloat(row[metric])).filter(v => !isNaN(v))
    if (values.length === 0) return 'No numeric data available for the selected metric.'

    const sum = values.reduce((a, b) => a + b, 0)
    const avg = sum / values.length
    const topRow = data.find(row => parseFloat(row[metric]) === Math.max(...values))
    const topName = topRow ? (topRow.state_name || topRow.county_name || topRow.zcta5 || 'Unknown') : 'N/A'

    return `This ${level === 'zcta5' ? 'ZIP Code' : level.charAt(0).toUpperCase() + level.slice(1)} level report covers ${data.length.toLocaleString()} locations within ${location}. The ${metric.replace(/_\d{4}$/, '').replace(/_/g, ' ')} metric shows an average value of ${formatValue(avg)}. ${topName} leads with the highest value of ${formatValue(Math.max(...values))}.`
  }

  return {
    exportToCSV,
    exportToJSON,
    exportToPDF,
    generateReportHTML,
    getExportMetadata,
    getRecentExports: () => recentExports.value,
    getKPIs,
    generateSummary
  }
}
