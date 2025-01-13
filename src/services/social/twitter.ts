import { elizaLogger } from "@elizaos/core"
import { AIService } from "../ai/ai"
import { AgentTwitterClientService } from "./agentTwitterClient"

interface TwitterConfig {
  username: string
  password: string
  email: string
  mockMode?: boolean
  maxRetries?: number
  retryDelay?: number
  contentRules: {
    maxEmojis: number
    maxHashtags: number
    minInterval: number
  }
  marketDataConfig: {
    heliusApiKey: string
    updateInterval: number
    volatilityThreshold: number
  }
  tokenAddresses: string[]
}

export class TwitterService {
  private client: AgentTwitterClientService
  private aiService: AIService
  private config: TwitterConfig
  private lastTweetTime: number = 0

  constructor(config: TwitterConfig, aiService: AIService) {
    this.config = config
    this.aiService = aiService

    // Initialize Twitter client with credentials
    this.client = new AgentTwitterClientService(
      config.username,
      config.password,
      config.email,
      aiService
    )
  }

  public async initialize(): Promise<void> {
    try {
      await this.client.initialize()
      elizaLogger.success("Twitter service initialized successfully")
    } catch (error) {
      elizaLogger.error("Failed to initialize Twitter service:", error)
      throw error
    }
  }

  public async stop(): Promise<void> {
    await this.client.cleanup()
  }

  private canTweet(): boolean {
    const now = Date.now()
    const timeSinceLastTweet = now - this.lastTweetTime
    return timeSinceLastTweet >= this.config.contentRules.minInterval
  }

  public async publishMarketUpdate(marketData: {
    price: number
    volume24h: number
    marketCap: number
    topHolders: string[]
    tokenAddress: string
  }): Promise<void> {
    try {
      if (!this.canTweet()) {
        elizaLogger.warn("Tweet rate limit exceeded, skipping market update")
        return
      }

      const content = await this.aiService.generateResponse({
        content: `Market Update:
Price: ${marketData.price} SOL
24h Volume: ${marketData.volume24h}
Market Cap: ${marketData.marketCap}`,
        platform: "twitter",
        author: "system",
        channel: "market",
      })

      await this.client.postTweet(content, { replyToTweetId: null })
      this.lastTweetTime = Date.now()
      elizaLogger.success("Market update tweet published successfully")
    } catch (error) {
      elizaLogger.error("Failed to publish market update:", error)
      throw error
    }
  }

  public async publishCommunityUpdate(metrics: {
    followers: number
    engagement: number
    sentiment: number
  }): Promise<void> {
    try {
      if (!this.canTweet()) {
        elizaLogger.warn("Tweet rate limit exceeded, skipping community update")
        return
      }

      const content = await this.aiService.generateResponse({
        content: `Community Update:
Followers: ${metrics.followers}
Engagement: ${metrics.engagement}
Sentiment: ${metrics.sentiment}`,
        platform: "twitter",
        author: "system",
        channel: "community",
      })

      await this.client.postTweet(content, { replyToTweetId: null })
      this.lastTweetTime = Date.now()
      elizaLogger.success("Community update tweet published successfully")
    } catch (error) {
      elizaLogger.error("Failed to publish community update:", error)
      throw error
    }
  }
}
