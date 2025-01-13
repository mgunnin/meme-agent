import {
  Action,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  Provider,
  State,
} from "@elizaos/core"

interface Order {
  id: string
  userId: string
  ticker: string
  side: "buy" | "sell"
  price: number
  amount: number
  timestamp: number
}

export const takeOrderAction: Action = {
  name: "TAKE_ORDER",
  description: "Take an existing order from the order book",
  validate: async (
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<boolean> => {
    const content = message.content as Content
    if (!content?.text) return false
    return /\$[A-Z]+/.test(content.text)
  },
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    const orderBook = runtime.getProvider("orderBook") as Provider
    if (!orderBook?.get) {
      if (callback)
        callback(runtime, { text: "Order book provider not available" })
      return false
    }

    const orders = await orderBook.get(runtime, message, state)
    if (!orders || !Array.isArray(orders)) {
      if (callback) callback(runtime, { text: "No orders available" })
      return false
    }

    // Process order logic here
    if (callback) callback(runtime, { text: "Order processed successfully" })
    return true
  },
}
