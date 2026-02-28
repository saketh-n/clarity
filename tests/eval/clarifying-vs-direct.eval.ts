import { describe, it, expect } from 'vitest'
import { invokeClarity, callJudge } from './harness'
import { CLARIFYING_JUDGE, DIRECT_GUIDANCE_JUDGE } from './judges'
import clarifyingInputs from '../fixtures/clarifying-inputs.json'
import directInputs from '../fixtures/direct-inputs.json'

describe('Clarifying Questions (vague/emotional inputs)', () => {
  for (const testCase of clarifyingInputs) {
    it(`asks clarifying questions for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      const verdict = await callJudge(
        CLARIFYING_JUDGE,
        `User input: "${testCase.input}"\n\nAgent response:\n${result.content}`
      )

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }
})

describe('Direct Guidance (structured/coherent inputs)', () => {
  for (const testCase of directInputs) {
    it(`provides direct guidance for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      const verdict = await callJudge(
        DIRECT_GUIDANCE_JUDGE,
        `User input: "${testCase.input}"\n\nAgent response:\n${result.content}`
      )

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }
})
