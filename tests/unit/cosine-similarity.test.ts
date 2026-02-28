import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '../../src/main/rag-nodes'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1.0)
  })

  it('returns 1 for same-direction vectors with different magnitude', () => {
    expect(cosineSimilarity([1, 0, 0], [5, 0, 0])).toBeCloseTo(1.0)
    expect(cosineSimilarity([2, 4, 6], [1, 2, 3])).toBeCloseTo(1.0)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.0)
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [-1, 0, 0])).toBeCloseTo(-1.0)
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1.0)
  })

  it('returns expected cosine for 45-degree vectors', () => {
    // cos(45°) ≈ 0.7071
    expect(cosineSimilarity([1, 0], [1, 1])).toBeCloseTo(Math.SQRT1_2, 4)
  })

  it('handles negative components correctly', () => {
    const a = [1, -1]
    const b = [-1, 1]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0)
  })
})
