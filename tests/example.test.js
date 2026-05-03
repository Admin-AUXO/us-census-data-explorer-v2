import { describe, it, expect } from 'vitest'

describe('example test', () => {
  it('should pass basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    const str = 'hello world'
    expect(str.includes('world')).toBe(true)
    expect(str.split(' ')).toHaveLength(2)
  })
})
