import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core"
interface Order {
  userId: string
  ticker: string
  contractAddress: string
  timestamp: string
  buyAmount: number
  price: number
}

const orderBookProvider: Provider = {
  name: "orderBook",
  initialize: async () => {
    // Initialization logic if needed
  },
  get: async (runtime: IAgentRuntime, message: Memory, _state?: State) => {
    const userId = message.userId
    if (!userId) {
      throw new Error("User ID is required")
    }
    const orderBookPath = `orderBook:${userId}`
    const orderBook = await runtime.cacheManager.get<Order[]>(orderBookPath)
    return orderBook || []
  },
}

export { orderBookProvider }
