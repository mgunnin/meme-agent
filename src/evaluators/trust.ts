import {
  Evaluator,
  IAgentRuntime,
  Memory,
  Provider,
  State,
} from "@elizaos/core"

interface TrustScore {
  score: number
  reason: string
}

export const trustEvaluator: Evaluator = {
  name: "trust",
  description:
    "Evaluates trust score based on user interactions and token metrics",
  evaluate: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<boolean> => {
    const trustScoreProvider = runtime.getProvider("trustScore") as Provider
    if (!trustScoreProvider?.get) {
      return false
    }

    const trustScore = (await trustScoreProvider.get(
      runtime,
      message,
      state
    )) as TrustScore
    if (!trustScore || trustScore.score < 0.5) {
      return false
    }

    return true
  },
}

export default trustEvaluator
