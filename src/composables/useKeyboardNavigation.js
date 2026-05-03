import { ref, onMounted, onUnmounted } from 'vue'
import { useCensusStore } from '../stores/census'

export const useKeyboardNavigation = (options = {}) => {
  const store = useCensusStore()
  const { onToggleFilters, onToggleHelp, onOpenCommandPalette } = options

  const focusedBreadcrumbIndex = ref(-1)
  const focusedRowIndex = ref(-1)
  const ggSequence = ref([])
  let ggTimeout = null

  const isInputFocused = () => {
    const tag = document.activeElement?.tagName
    return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA'
  }

  const handleGlobalKeydown = (event) => {
    if (isInputFocused()) return

    const key = event.key
    const ctrl = event.ctrlKey || event.metaKey
    const shift = event.shiftKey

    if (key === 'Escape') {
      event.preventDefault()
      handleEscape()
      return
    }

    if (key === '?') {
      event.preventDefault()
      onToggleHelp?.()
      return
    }

    if (key === '/' && !shift) {
      event.preventDefault()
      focusSearchInput()
      return
    }

    if (key === 'g') {
      ggSequence.value.push('g')
      clearTimeout(ggTimeout)
      ggTimeout = setTimeout(() => {
        ggSequence.value = []
      }, 500)
      if (ggSequence.value.length >= 2) {
        event.preventDefault()
        onOpenCommandPalette?.()
        ggSequence.value = []
      }
      return
    }

    if (ctrl && key === 'k') {
      event.preventDefault()
      onOpenCommandPalette?.()
      return
    }

    if (key === 'r' && !ctrl) {
      event.preventDefault()
      store.reset()
      return
    }

    if (key === 'f' && !ctrl) {
      event.preventDefault()
      onToggleFilters?.()
      return
    }

    if (key === 's' && !ctrl) {
      event.preventDefault()
      focusFirstDropdown()
      return
    }
  }

  const handleEscape = () => {
    if (store.currentLevel !== 'state') {
      store.reset()
    }
    onToggleHelp?.()
    onToggleFilters?.()
  }

  const focusSearchInput = () => {
    const searchInput = document.getElementById('search-input')
    if (searchInput) {
      searchInput.focus()
    }
  }

  const focusFirstDropdown = () => {
    const datasetSelect = document.getElementById('dataset-select')
    if (datasetSelect && !datasetSelect.disabled) {
      datasetSelect.focus()
    }
  }

  const handleBreadcrumbKeydown = (event, index, totalItems) => {
    const key = event.key

    if (key === 'ArrowRight') {
      event.preventDefault()
      focusedBreadcrumbIndex.value = Math.min(index + 1, totalItems - 1)
      focusBreadcrumbItem(focusedBreadcrumbIndex.value)
    } else if (key === 'ArrowLeft') {
      event.preventDefault()
      focusedBreadcrumbIndex.value = Math.max(index - 1, 0)
      focusBreadcrumbItem(focusedBreadcrumbIndex.value)
    } else if (key === 'Home') {
      event.preventDefault()
      focusedBreadcrumbIndex.value = 0
      focusBreadcrumbItem(0)
    } else if (key === 'End') {
      event.preventDefault()
      focusedBreadcrumbIndex.value = totalItems - 1
      focusBreadcrumbItem(totalItems - 1)
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      return index
    }
    return -1
  }

  const focusBreadcrumbItem = (index) => {
    const items = document.querySelectorAll('.breadcrumb-item[tabindex="0"]')
    if (items[index]) {
      items[index].focus()
    }
  }

  const getBreadcrumbItems = () => {
    const items = []
    if (store.currentLevel === 'state') {
      items.push({ level: 'root', label: 'United States' })
    } else if (store.currentLevel === 'county') {
      items.push({ level: 'root', label: 'United States' })
      items.push({ level: 'state', label: store.currentState })
    } else if (store.currentLevel === 'zcta5') {
      items.push({ level: 'root', label: 'United States' })
      items.push({ level: 'state', label: store.currentState })
      items.push({ level: 'county', label: store.currentCounty })
    }
    return items
  }

  const handleTableKeydown = (event, rowIndex, totalRows, row) => {
    const key = event.key

    if (key === 'ArrowDown') {
      event.preventDefault()
      focusedRowIndex.value = Math.min(rowIndex + 1, totalRows - 1)
      focusTableRow(focusedRowIndex.value)
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      focusedRowIndex.value = Math.max(rowIndex - 1, 0)
      focusTableRow(focusedRowIndex.value)
    } else if (key === 'Home') {
      event.preventDefault()
      focusedRowIndex.value = 0
      focusTableRow(0)
    } else if (key === 'End') {
      event.preventDefault()
      focusedRowIndex.value = totalRows - 1
      focusTableRow(totalRows - 1)
    } else if (key === 'Enter') {
      event.preventDefault()
      if (store.currentLevel === 'state') {
        store.drillToState(row.state_name)
      } else if (store.currentLevel === 'county') {
        store.drillToCounty(row.county_name)
      }
    }
    return focusedRowIndex.value
  }

  const focusTableRow = (index) => {
    const rows = document.querySelectorAll('.data-table tbody tr[tabindex="0"]')
    if (rows[index]) {
      rows[index].focus()
      rows[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  const resetTableFocus = () => {
    focusedRowIndex.value = -1
  }

  const resetBreadcrumbFocus = () => {
    focusedBreadcrumbIndex.value = -1
  }

  onMounted(() => {
    document.addEventListener('keydown', handleGlobalKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleGlobalKeydown)
    clearTimeout(ggTimeout)
  })

  return {
    focusedBreadcrumbIndex,
    focusedRowIndex,
    handleBreadcrumbKeydown,
    handleTableKeydown,
    focusSearchInput,
    focusFirstDropdown,
    resetTableFocus,
    resetBreadcrumbFocus,
    getBreadcrumbItems
  }
}