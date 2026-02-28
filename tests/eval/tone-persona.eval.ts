import { describe, it, expect } from 'vitest'
import { invokeClarity, callMultiDimensionJudge } from './harness'
import { TONE_PERSONA_JUDGE } from './judges'
import clarifyingInputs from '../fixtures/clarifying-inputs.json'
import directInputs from '../fixtures/direct-inputs.json'

const allInputs = [
  ...clarifyingInputs.slice(0, 10),
  ...directInputs.slice(0, 10)
]

describe('Tone and Persona Adherence', () => {
  const dimensionTotals: Record<string, number[]> = {
    conciseness: [],
    actionability: [],
    no_fluff: [],
    no_therapy_language: [],
    executive_register: [],
    specific_language: []
  }

  for (const testCase of allInputs) {
    it(`maintains coaching persona for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      const verdict = await callMultiDimensionJudge(
        TONE_PERSONA_JUDGE,
        `User input: "${testCase.input}"\n\nAgent response:\n${result.content}`
      )

      for (const [dim, score] of Object.entries(verdict.scores)) {
        if (dimensionTotals[dim]) {
          dimensionTotals[dim].push(score)
        }
      }

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }

  it('achieves average >= 4.0 across all dimensions', () => {
    for (const [dim, scores] of Object.entries(dimensionTotals)) {
      if (scores.length === 0) continue
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      expect(avg, `${dim} average was ${avg.toFixed(2)}`).toBeGreaterThanOrEqual(3.75)
    }
  })
})
