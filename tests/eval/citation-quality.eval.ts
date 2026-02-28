import { describe, it, expect } from 'vitest'
import { invokeClarity, callJudge, hasToolCalls } from './harness'
import { CITATION_QUALITY_JUDGE } from './judges'
import toolUseInputs from '../fixtures/tool-use-inputs.json'

describe('Citation Quality (for queries that trigger search)', () => {
  for (const testCase of toolUseInputs.should_search) {
    it(`integrates citations properly for: "${testCase.input.slice(0, 60)}..."`, async () => {
      const result = await invokeClarity(testCase.input)

      if (!hasToolCalls(result.allMessages)) {
        expect.fail(`Search was not triggered for: "${testCase.input}" — cannot evaluate citations`)
      }

      const verdict = await callJudge(
        CITATION_QUALITY_JUDGE,
        `User input: "${testCase.input}"\n\nAgent response:\n${result.content}`
      )

      expect(verdict.pass, verdict.reasoning).toBe(true)
    })
  }
})
