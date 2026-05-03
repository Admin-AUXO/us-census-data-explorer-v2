import { describe, it, expect } from 'vitest'
import { formatValue, formatPercent, formatChange, formatDatasetName, formatArea } from '../../src/utils/formatUtils'

describe('formatUtils', () => {
  describe('formatValue', () => {
    it('should return N/A for null values', () => {
      expect(formatValue(null)).toBe('N/A')
    })

    it('should return N/A for empty string', () => {
      expect(formatValue('')).toBe('N/A')
    })

    it('should format numbers with locale string', () => {
      expect(formatValue(1234)).toBe('1,234')
      expect(formatValue(1234567.89)).toBe('1,234,567.89')
    })

    it('should return original value for non-numeric strings', () => {
      expect(formatValue('abc')).toBe('abc')
    })

    it('should handle decimals', () => {
      expect(formatValue(123.456789)).toBe('123.46')
    })
  })

  describe('formatPercent', () => {
    it('should return N/A for null values', () => {
      expect(formatPercent(null)).toBe('N/A')
    })

    it('should return N/A for empty string', () => {
      expect(formatPercent('')).toBe('N/A')
    })

    it('should format percentages with default 1 decimal', () => {
      expect(formatPercent(45.67)).toBe('45.7%')
    })

    it('should format with custom decimals', () => {
      expect(formatPercent(45.678, 2)).toBe('45.68%')
    })

    it('should return N/A for non-numeric strings', () => {
      expect(formatPercent('abc')).toBe('N/A')
    })
  })

  describe('formatChange', () => {
    it('should return N/A when current is NaN', () => {
      const result = formatChange('abc', 100)
      expect(result.absolute).toBe('N/A')
      expect(result.percent).toBe('N/A')
      expect(result.class).toBe('change-neutral')
    })

    it('should return N/A when previous is 0', () => {
      const result = formatChange(100, 0)
      expect(result.absolute).toBe('N/A')
      expect(result.percent).toBe('N/A')
    })

    it('should calculate positive change', () => {
      const result = formatChange(120, 100)
      expect(result.absolute).toBe('+20')
      expect(result.percent).toBe('+20.0%')
      expect(result.class).toBe('change-positive')
    })

    it('should calculate negative change', () => {
      const result = formatChange(80, 100)
      expect(result.absolute).toBe('-20')
      expect(result.percent).toBe('-20.0%')
      expect(result.class).toBe('change-negative')
    })

    it('should show zero change as neutral', () => {
      const result = formatChange(100, 100)
      expect(result.absolute).toBe('+0')
      expect(result.class).toBe('change-neutral')
    })

    it('should hide percent when showPercent is false', () => {
      const result = formatChange(120, 100, false)
      expect(result.percent).toBe('')
    })
  })

  describe('formatDatasetName', () => {
    it('should remove .csv extension', () => {
      expect(formatDatasetName('datafile.csv')).toBe('Datafile')
    })

    it('should replace underscores with spaces', () => {
      expect(formatDatasetName('acs_5_year')).toBe('Acs 5 Year')
    })

    it('should capitalize first letter of each word', () => {
      expect(formatDatasetName('acs_5_year_estimates')).toBe('Acs 5 Year Estimates')
    })

    it('should handle complex filenames', () => {
      expect(formatDatasetName('acs_5_year_estimates_2023.csv')).toBe('Acs 5 Year Estimates 2023')
    })
  })

  describe('formatArea', () => {
    it('should return N/A for null values', () => {
      expect(formatArea(null)).toBe('N/A')
    })

    it('should return N/A for zero', () => {
      expect(formatArea(0)).toBe('N/A')
    })

    it('should format values less than 1 with 3 decimals', () => {
      expect(formatArea(0.5)).toBe('0.500')
    })

    it('should format values 1 or greater with 2 decimals', () => {
      expect(formatArea(1.234)).toBe('1.23')
      expect(formatArea(100)).toBe('100.00')
    })

    it('should return N/A for non-numeric strings', () => {
      expect(formatArea('abc')).toBe('N/A')
    })
  })
})
