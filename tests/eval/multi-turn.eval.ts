import { describe, it, expect } from 'vitest'
import { invokeClarityMultiTurn, callJudge } from './harness'
import { MULTI_TURN_JUDGE } from './judges'
import scenarios from '../fixtures/multi-turn-scenarios.json'

describe('Multi-Turn Conversation Coherence', () => {
  for (const scenario of scenarios) {
    describe(`scenario: ${scenario.name}`, () => {
      const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = []

      for (let i = 0; i < scenario.turns.length; i++) {
        const turn = scenario.turns[i]

        it(`turn ${i + 1}: "${turn.user.slice(0, 50)}..." → expects ${turn.expect}`, async () => {
          conversationHistory.push({ role: 'user', content: turn.user })

          const result = await invokeClarityMultiTurn(conversationHistory)

          conversationHistory.push({ role: 'assistant', content: result.content })

          const historyContext = conversationHistory
            .map((m) => `${m.role}: ${m.content}`)
            .join('\n\n')

          const verdict = await callJudge(
            MULTI_TURN_JUDGE,
            `Full conversation so far:\n${historyContext}\n\nExpected response type for the latest assistant turn: "${turn.expect}"\n\nEvaluate ONLY the latest assistant response.`
          )

          expect(verdict.pass, verdict.reasoning).toBe(true)
        })
      }
    })
  }
})
