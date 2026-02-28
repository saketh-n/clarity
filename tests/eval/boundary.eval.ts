import { describe, it, expect } from 'vitest'
import { invokeClarity, callJudge } from './harness'
import { BOUNDARY_JUDGE } from './judges'
import boundaryInputs from '../fixtures/boundary-inputs.json'

describe('Boundary Handling', () => {
  for (const testCase of boundaryInputs) {
    it(`handles boundary: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      const verdict = await callJudge(
        BOUNDARY_JUDGE,
        `User input: "${testCase.input}"\n\nExpected boundary behavior: "${testCase.expected}"\n\nAgent response:\n${result.content}`
      )

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }
})
