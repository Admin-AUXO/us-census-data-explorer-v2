import { describe, it, expect } from 'vitest'
import { createFilterSet, checkFilterMatch, parseNumericFilter, checkNumericRange, searchInFields } from '../../src/utils/filterUtils'

describe('filterUtils', () => {
  describe('createFilterSet', () => {
    it('should create a Set from array', () => {
      const result = createFilterSet(['a', 'b', 'c'])
      expect(result).toBeInstanceOf(Set)
      expect(result.size).toBe(3)
    })

    it('should return null for empty array', () => {
      expect(createFilterSet([])).toBe(null)
    })

    it('should return null for null input', () => {
      expect(createFilterSet(null)).toBe(null)
    })

    it('should return null for undefined input', () => {
      expect(createFilterSet(undefined)).toBe(null)
    })
  })

  describe('checkFilterMatch', () => {
    it('should return true when filterSet is null', () => {
      expect(checkFilterMatch('value', null)).toBe(true)
    })

    it('should return true when value is in filterSet', () => {
      const filterSet = new Set(['a', 'b', 'c'])
      expect(checkFilterMatch('a', filterSet)).toBe(true)
    })

    it('should return false when value is not in filterSet', () => {
      const filterSet = new Set(['a', 'b', 'c'])
      expect(checkFilterMatch('d', filterSet)).toBe(false)
    })
  })

  describe('parseNumericFilter', () => {
    it('should parse valid numbers', () => {
      expect(parseNumericFilter('123')).toBe(123)
      expect(parseNumericFilter('123.45')).toBe(123.45)
      expect(parseNumericFilter(-50)).toBe(-50)
    })

    it('should return null for null input', () => {
      expect(parseNumericFilter(null)).toBe(null)
    })

    it('should return null for empty string', () => {
      expect(parseNumericFilter('')).toBe(null)
    })

    it('should return null for non-numeric strings', () => {
      expect(parseNumericFilter('abc')).toBe(null)
    })
  })

  describe('checkNumericRange', () => {
    it('should return true when value is within range', () => {
      expect(checkNumericRange(50, 0, 100)).toBe(true)
      expect(checkNumericRange(0, 0, 100)).toBe(true)
      expect(checkNumericRange(100, 0, 100)).toBe(true)
    })

    it('should return false when value is below minimum', () => {
      expect(checkNumericRange(-1, 0, 100)).toBe(false)
    })

    it('should return false when value is above maximum', () => {
      expect(checkNumericRange(101, 0, 100)).toBe(false)
    })

    it('should handle null min (no lower bound)', () => {
      expect(checkNumericRange(150, null, 200)).toBe(true)
      expect(checkNumericRange(250, null, 200)).toBe(false)
    })

    it('should handle null max (no upper bound)', () => {
      expect(checkNumericRange(50, 0, null)).toBe(true)
      expect(checkNumericRange(-10, 0, null)).toBe(false)
    })

    it('should parse string values', () => {
      expect(checkNumericRange('50', 0, 100)).toBe(true)
    })
  })

  describe('searchInFields', () => {
    const row = {
      name: 'California',
      abbr: 'CA',
      region: 'West'
    }

    it('should return true when query matches in any field', () => {
      expect(searchInFields(row, 'California', ['name', 'abbr'])).toBe(true)
      expect(searchInFields(row, 'CA', ['name', 'abbr'])).toBe(true)
      expect(searchInFields(row, 'west', ['name', 'abbr', 'region'])).toBe(true)
    })

    it('should return true when query is empty', () => {
      expect(searchInFields(row, '', ['name'])).toBe(true)
    })

    it('should return false when query does not match', () => {
      expect(searchInFields(row, 'Texas', ['name', 'abbr'])).toBe(false)
    })

    it('should handle missing field values', () => {
      const incompleteRow = { name: 'California' }
      expect(searchInFields(incompleteRow, 'California', ['name', 'abbr'])).toBe(true)
      expect(searchInFields(incompleteRow, 'Texas', ['name', 'abbr'])).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(searchInFields(row, 'CALIFORNIA', ['name'])).toBe(true)
      expect(searchInFields(row, 'west', ['region'])).toBe(true)
    })
  })
})
