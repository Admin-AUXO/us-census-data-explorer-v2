import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCensusStore } from '../../src/stores/census'
import { useExport } from '../../src/composables/useExport'

describe('useExport', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('generateReportHTML', () => {
    it('escapes generated report text before inserting it into HTML', () => {
      const store = useCensusStore()
      store.currentLevel = 'county'
      store.currentState = '<img src=x onerror=alert(1)>'
      store.currentYear = '2024"><img src=x onerror=alert(1)>'
      store.currentMetric = 'income_<script>alert(1)</script>_2024'
      store.searchQuery = '"><svg onload=alert(1)>'
      store.dimensionFilters.selectedRegions = ['<b>West</b>']

      const { generateReportHTML } = useExport()
      const html = generateReportHTML({
        title: '<img src=x onerror=alert(1)>',
        summary: 'Summary <script>alert(1)</script>',
        kpis: [
          {
            label: '<script>alert(1)</script>',
            value: '"><img src=x onerror=alert(1)>'
          }
        ],
        data: [
          {
            'bad_<img src=x onerror=alert(1)>': '<svg onload=alert(1)>',
            plain: 'AT&T "quoted"'
          }
        ]
      })

      expect(html).not.toContain('<script>alert(1)</script>')
      expect(html).not.toContain('<img src=x onerror=alert(1)>')
      expect(html).not.toContain('<svg onload=alert(1)>')
      expect(html).not.toContain('<b>West</b>')
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
      expect(html).toContain('&lt;svg onload=alert(1)&gt;')
      expect(html).toContain('AT&amp;T &quot;quoted&quot;')
      expect(html).toContain('&lt;b&gt;West&lt;/b&gt;')
    })
  })
})
