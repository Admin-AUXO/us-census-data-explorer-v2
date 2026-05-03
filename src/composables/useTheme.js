import { ref } from 'vue'

const THEME_KEY = 'census-explorer-theme'
const isDark = ref(true)

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved !== null) {
      isDark.value = saved !== 'light'
    }
  } catch (e) {
    isDark.value = true
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch (e) {
    // localStorage not available
  }
}

function applyTheme(dark) {
  if (dark) {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', 'light')
  }
}

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
    applyTheme(isDark.value)
    saveTheme(isDark.value ? 'dark' : 'light')
  }

  function setTheme(dark) {
    isDark.value = dark
    applyTheme(dark)
    saveTheme(isDark.value ? 'dark' : 'light')
  }

  function initTheme() {
    loadTheme()
    applyTheme(isDark.value)
  }

  return {
    isDark,
    toggleTheme,
    setTheme,
    initTheme
  }
}
