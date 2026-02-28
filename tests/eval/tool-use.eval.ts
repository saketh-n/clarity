import { describe, it, expect } from 'vitest'
import { invokeClarity, hasToolCalls } from './harness'
import toolUseInputs from '../fixtures/tool-use-inputs.json'

describe('Tool Use — Should Search', () => {
  for (const testCase of toolUseInputs.should_search) {
    it(`uses search for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)
      expect(
        hasToolCalls(result.allMessages),
        `Expected search tool call for: "${testCase.input}"`
      ).toBe(true)
    })
  }
})

describe('Tool Use — Should NOT Search', () => {
  for (const testCase of toolUseInputs.should_not_search) {
    it(`skips search for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)
      expect(
        hasToolCalls(result.allMessages),
        `Expected no search tool call for: "${testCase.input}"`
      ).toBe(false)
    })
  }
})
