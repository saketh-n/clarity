import { describe, it, expect } from 'vitest'
import { invokeClarity, callMultiDimensionJudge } from './harness'
import { QUALITY_RUBRIC_JUDGE } from './judges'
import clarifyingInputs from '../fixtures/clarifying-inputs.json'
import directInputs from '../fixtures/direct-inputs.json'

const allInputs = [
  ...clarifyingInputs.slice(0, 10),
  ...directInputs.slice(0, 10)
]

describe('Quality Rubric', () => {
  const dimensionTotals: Record<string, number[]> = {
    relevance: [],
    specificity: [],
    framing: [],
    completeness: [],
    structure: []
  }

  for (const testCase of allInputs) {
    it(`meets quality bar for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      const verdict = await callMultiDimensionJudge(
        QUALITY_RUBRIC_JUDGE,
        `User input: "${testCase.input}"\n\nAgent response:\n${result.content}`
      )

      for (const [dim, score] of Object.entries(verdict.scores)) {
        if (dimensionTotals[dim]) {
          dimensionTotals[dim].push(score)
        }
        expect(score, `${dim} scored ${score} (min 2) for: "${testCase.input.slice(0, 40)}..."`).toBeGreaterThanOrEqual(2)
      }

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }

  it('achieves average >= 3.5 across all dimensions', () => {
    for (const [dim, scores] of Object.entries(dimensionTotals)) {
      if (scores.length === 0) continue
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      expect(avg, `${dim} average was ${avg.toFixed(2)}`).toBeGreaterThanOrEqual(3.5)
    }
  })
})
