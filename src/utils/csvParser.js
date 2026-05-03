import Papa from 'papaparse'

export const parseCSV = async (text, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      reject(new Error('Empty or invalid CSV text provided'))
      return
    }

    const lines = text.split('\n').filter(line => line.trim().length > 0)
    const estimatedTotal = Math.max(1, lines.length - 1)
    const collectedData = []
    let rowCount = 0
    let errorCount = 0

    Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      fastMode: false,
      worker: false,
      silent: true,
      step: (result) => {
        if (result.data && Object.keys(result.data).length > 0) {
          collectedData.push(result.data)
        }
        if (result.errors && result.errors.length > 0) {
          const criticalErrors = result.errors.filter(e => e.type !== 'FieldMismatch')
          if (criticalErrors.length > 0) {
            errorCount += criticalErrors.length
          }
        }
        rowCount++
        if (onProgress && rowCount % 5000 === 0) {
          onProgress({ loaded: rowCount, total: estimatedTotal, percentage: Math.min(95, Math.round((rowCount / estimatedTotal) * 100)), stage: 'Parsing data...' })
        }
      },
      chunkSize: 2 * 1024 * 1024,
      complete: (results) => {
        if (errorCount > 0 && import.meta.env.DEV) {
          console.warn(`[CSV Parser] ${errorCount} rows had critical parsing errors`)
        }
        const finalData = collectedData
        if (!Array.isArray(finalData)) {
          reject(new Error(`Invalid parse result: expected array, got ${typeof finalData}`))
          return
        }
        if (finalData.length === 0) {
          const errorMsg = `No data rows parsed from CSV. Lines: ${lines.length}, Results errors: ${results?.errors?.length || 0}`
          console.error('[CSV Parser]', errorMsg)
          reject(new Error(errorMsg))
          return
        }
        if (onProgress) {
          onProgress({ loaded: finalData.length, total: finalData.length, percentage: 100, stage: 'Processing complete' })
        }
        resolve(finalData)
      },
      error: (error) => {
        console.error('[CSV Parser] Parse error:', error)
        reject(error)
      }
    })
  })
}
