import { elizaLogger } from "@elizaos/core"
import { JupiterPriceV2Service } from "../blockchain/defi/JupiterPriceV2Service"
import { MarketDataProcessor } from "../market/data/DataProcessor"
import { DiscordService } from "./discord"
import { TwitterService } from "./twitter"

export interface SocialMetrics {
  followers: number
  engagement: number
  activity: string
}

export interface SocialConfig {
  services: {
    ai: any // Let the concrete implementations handle AI type checking
  }
  discord?: {
    token: string
    guildId: string
  }
  twitter?: {
    username: string
    password: string
    email: string
    mockMode?: boolean
    maxRetries?: number
    retryDelay?: number
    contentRules?: {
      maxEmojis: number
      maxHashtags: number
      minInterval: number
    }
    marketDataConfig?: {
      heliusApiKey: string
      updateInterval: number
      volatilityThreshold: number
    }
  }
  helius?: {
    apiKey: string
  }
  redis?: {
    host?: string
    port?: number
    password?: string
  }
}

export class SocialService {
  private twitterService?: TwitterService
  private discordService?: DiscordService
  private readonly dataProcessor: MarketDataProcessor
  private readonly jupiterService: JupiterPriceV2Service

  constructor(config: SocialConfig) {
    if (!config.helius?.apiKey) {
      throw new Error("Helius API key is required")
    }

    // Initialize services with proper configuration
    this.jupiterService = new JupiterPriceV2Service({
      redis: {
        host: config.redis?.host || process.env.REDIS_HOST,
        port: config.redis?.port || parseInt(process.env.REDIS_PORT || "6379"),
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        keyPrefix: "jupiter-price:",
        enableCircuitBreaker: true,
      },
    })

    // Initialize data processor with price fetcher
    this.dataProcessor = new MarketDataProcessor(
      config.helius.apiKey,
      "https://tokens.jup.ag/tokens?tags=verified"
    )

    if (config.twitter) {
      this.twitterService = new TwitterService(
        {
          username: config.twitter.username,
          password: config.twitter.password,
          email: config.twitter.email,
          mockMode: config.twitter.mockMode,
          maxRetries: config.twitter.maxRetries,
          retryDelay: config.twitter.retryDelay,
          contentRules: config.twitter.contentRules || {
            maxEmojis: 0,
            maxHashtags: 0,
            minInterval: 0,
          },
          marketDataConfig: {
            heliusApiKey: config.helius.apiKey,
            updateInterval: 1800000, // 30 minutes
            volatilityThreshold: 0.05,
          },
          tokenAddresses: [],
        },
        config.services.ai
      )
    }

    if (config.discord) {
      this.discordService = new DiscordService({
        token: config.discord.token,
        guildId: config.discord.guildId,
        aiService: config.services.ai,
      })
    }
  }

  async initialize(): Promise<void> {
    try {
      const initPromises: Promise<void>[] = []

      if (this.twitterService) {
        initPromises.push(this.twitterService.initialize())
      }

      if (this.discordService) {
        // DiscordService auto-initializes in constructor
        initPromises.push(Promise.resolve())
      }

      await Promise.all(initPromises)
      elizaLogger.success("Social services initialized successfully")
    } catch (error) {
      elizaLogger.error("Failed to initialize social services:", error)
      throw error
    }
  }

  async getCommunityMetrics(): Promise<SocialMetrics> {
    return {
      followers: 1000,
      engagement: 0.75,
      activity: "High",
    }
  }

  async send(content: string): Promise<void> {
    const promises: Promise<void>[] = []

    if (this.twitterService) {
      try {
        await this.twitterService.publishCommunityUpdate({
          followers: 0,
          engagement: 0,
          sentiment: 0,
        })
        promises.push(Promise.resolve())
      } catch (error) {
        elizaLogger.error("Failed to send tweet:", error)
        promises.push(Promise.reject(error))
      }
    }

    if (this.discordService) {
      promises.push(this.discordService.sendMessage("System", content))
    }

    await Promise.all(promises)
  }

  async sendMessage(
    platform: string,
    messageId: string,
    content: string
  ): Promise<void> {
    try {
      switch (platform.toLowerCase()) {
        case "twitter":
          if (this.twitterService) {
            await this.twitterService.publishCommunityUpdate({
              followers: 0,
              engagement: 0,
              sentiment: 0,
            })
          }
          break
        case "discord":
          if (this.discordService) {
            await this.discordService.sendMessage(messageId, content)
          }
          break
        default:
          throw new Error(`Unsupported platform: ${platform}`)
      }
    } catch (error) {
      elizaLogger.error(`Failed to send message to ${platform}:`, error)
      throw error
    }
  }
}

export { DiscordService } from "./discord"
export { TwitterService } from "./twitter"
export default SocialService
