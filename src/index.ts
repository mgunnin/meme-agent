import { MemorySaver } from "@langchain/langgraph"
import { Client as DiscordClient, Message } from "discord.js"
import dotenv from "dotenv"
import Groq from "groq-sdk"
// Import services
import { TradingService } from "./services/blockchain/trading.js"
import { SocialService } from "./services/social/index.js"
import { Content } from "./utils/content.js"
import { Parser } from "./utils/parser.js"
// Types
import {
  AgentCommand,
  CommandContext,
  MarketAnalysis,
  TokenInfo,
  TradeResult,
} from "./services/blockchain/types.js"
import { SocialMetrics } from "./services/social/index.js"
import { AgentTwitterClientService } from "./services/social/agentTwitterClient.js"

import { elizaLogger, IAgentRuntime } from "@ai16z/eliza"

// Import mainCharacter from local file
import { mainCharacter } from "./mainCharacter.js"

declare module "@langchain/langgraph" {
  interface MemorySaver {
    save(data: { role: string; content: string }): Promise<void>
  }
}

dotenv.config()
loadConfig()

interface ServiceConfig {
  dataProcessor: any
  aiService: AIService
  twitterService: AgentTwitterClientService
  tradingService?: TradingService
  jupiterPriceService?: JupiterPriceV2Service
  jupiterPriceV2Service?: JupiterPriceV2Service
  chatService?: any
}

async function fetchTokenAddresses(): Promise<string[]> {
  try {
    const response = await axios.get(
      "https://tokens.jup.ag/tokens?tags=verified"
    )
    return response.data.map((token: any) => token.address)
  } catch (error) {
    elizaLogger.error("Failed to fetch token addresses:", error)
    throw error
  }
}

async function initializeServices() {
  try {
    // Fetch token addresses dynamically
    const tokenAddresses = await fetchTokenAddresses()

    // Initialize data processor
    const dataProcessor = new MarketDataProcessor(
      process.env.HELIUS_API_KEY!,
      "https://tokens.jup.ag/tokens?tags=verified",
      CONFIG.SOLANA.PUBLIC_KEY
    )

    // Initialize AI service
    const aiService: AIService = new AIService({
      groqApiKey: process.env.GROQ_API_KEY!,
      defaultModel: CONFIG.AI.GROQ.MODEL,
      maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
      temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE,
    })

    // Initialize Twitter service with direct authentication
    const twitterService = new AgentTwitterClientService(
      process.env.TWITTER_USERNAME!,
      process.env.TWITTER_PASSWORD!,
      process.env.TWITTER_EMAIL!,
      aiService
    )

    // Initialize WalletProvider
    const walletProviderInstance = new WalletProvider(
      new Connection(CONFIG.SOLANA.RPC_URL),
      new PublicKey(CONFIG.SOLANA.PUBLIC_KEY)
    )

    // Initialize TokenProvider
    const cacheAdapter = {
      async get<T>(key: string): Promise<T | undefined> {
        return cache.get(key)
      },
      async set<T>(key: string, value: T, options?: any): Promise<void> {
        cache.set(key, value, options?.ttl)
      },
      async delete(key: string): Promise<void> {
        cache.del(key)
      },
    }

    const cache = new NodeCache()
    const tokenProviderInstance = new TokenProvider(
      tokenAddresses[0],
      walletProviderInstance,
      cacheAdapter,
      { apiKey: CONFIG.SOLANA.RPC_URL }
    )

    // Initialize JupiterService
    const jupiterService = new JupiterService()

    // Initialize JupiterPriceV2Service
    const jupiterPriceV2Service = new JupiterPriceV2Service(
      {
        redis: {
          host: process.env.REDIS_HOST!,
          keyPrefix: "jupiter-price:",
          enableCircuitBreaker: true,
        },
        rpcConnection: {
          url: CONFIG.SOLANA.RPC_URL,
          walletPublicKey: PublicKey.toString(),
        },
        rateLimitConfig: {
          requestsPerMinute: 600,
          windowMs: 60000,
        },
      },
      tokenProviderInstance,
      redisService as unknown as RedisService
    )

    // Initialize ChatService
    const chatService = new ChatService(
      aiService,
      twitterService,
      jupiterPriceV2Service!
    )

    return {
      dataProcessor,
      aiService,
      twitterService,
      jupiterPriceV2Service,
      chatService,
    }
  } catch (error) {
    elizaLogger.error("Failed to initialize services:", error)
    throw error
  }
}

function validateEnvironment() {
  const requiredEnvVars = [
    "GROQ_API_KEY",
    "HELIUS_API_KEY",
    "TWITTER_USERNAME",
    "TWITTER_PASSWORD",
    "TWITTER_EMAIL",
  ]

  const missing = requiredEnvVars.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    )
  }
}

function logConfiguration() {
  elizaLogger.info("Configuration loaded:", {
    network: CONFIG.SOLANA.NETWORK,
    rpcUrl: CONFIG.SOLANA.RPC_URL,
    pubkey: CONFIG.SOLANA.PUBLIC_KEY,
  })

  // Log environment variables (redacted)
  const envVars = ["TWITTER_USERNAME", "TWITTER_EMAIL"]

  envVars.forEach((key) => {
    const value = process.env[key]
    elizaLogger.info(`${key}: ${value ? "****" + value.slice(-4) : "Not set"}`)
  })
}

// Extend IAgentRuntime to include llm
interface ExtendedAgentRuntime extends IAgentRuntime {
  llm: Groq
}

class MemeAgentInfluencer {
  private connection!: Connection
  private groq!: Groq
  private discord!: DiscordClient
  private aiService!: AIService
  private socialService!: SocialService
  private tradingService!: TradingService
  private twitterService!: AgentTwitterClientService
  public tokenAddress: string

  public getTokenAddress(): string {
    return this.tokenAddress
  }
  private isInitialized: boolean
  private runtime!: ExtendedAgentRuntime

  constructor() {
    this.isInitialized = false
    this.tokenAddress = ""
  }

  async initialize(): Promise<void> {
    try {
      console.log("Initializing JENNA...")

      // 1. Initialize LLM
      await this.initializeLLM()

      // 2. Initialize Twitter
      await this.initializeTwitter()

      // 3. Initialize Solana
      await this.initializeSolana()

      // 4. Initialize Services
      await this.initializeServices()

      // 5. Start automation
      await this.startAutomation()

      this.isInitialized = true
      console.log("JENNA initialization complete")
    } catch (error) {
      console.error("Failed to initialize JENNA:", error)
      await this.cleanup()
      throw error
    }
  }

  private async initializeLLM(): Promise<void> {
    try {
      const groqApiKey = process.env.GROQ_API_KEY
      if (!groqApiKey) {
        throw new Error("GROQ API key not found")
      }

      this.groq = new Groq({ apiKey: groqApiKey })
      this.runtime = {
        llm: this.groq,
      } as ExtendedAgentRuntime

      this.aiService = new AIService({
        groqApiKey,
        defaultModel: CONFIG.AI.GROQ.MODEL,
        maxTokens: CONFIG.AI.GROQ.MAX_TOKENS,
        temperature: CONFIG.AI.GROQ.DEFAULT_TEMPERATURE,
      })

      console.log("LLM initialized successfully")
    } catch (error) {
      throw new Error(`Failed to initialize LLM: ${(error as Error).message}`)
    }
  }

  private async initializeTwitter(): Promise<void> {
    try {
      this.twitterService = new AgentTwitterClientService(
        process.env.TWITTER_USERNAME!,
        process.env.TWITTER_PASSWORD!,
        process.env.TWITTER_EMAIL!,
        this.aiService
      )
      await this.twitterService.initialize()
      console.log("Twitter service initialized successfully")
    } catch (error) {
      throw new Error(
        `Failed to initialize Twitter: ${(error as Error).message}`
      )
    }
  }

  private async initializeSolana(): Promise<void> {
    try {
      this.connection = new Connection(CONFIG.SOLANA.RPC_URL, {
        commitment: "confirmed",
        disableRetryOnRateLimit: false,
      })
      const version = await this.connection.getVersion()
      console.log("Solana connection established:", version)

      const publicKey = new PublicKey(CONFIG.SOLANA.PUBLIC_KEY)
      const balance = await this.connection.getBalance(publicKey)
      console.log("Wallet balance:", balance / 1e9, "SOL")

      this.tradingService = new TradingService(
        CONFIG.SOLANA.RPC_URL,
        process.env.HELIUS_API_KEY!,
        `https://price.jup.ag/v4/price?ids=${this.tokenAddress}`,
        "https://tokens.jup.ag/tokens?tags=verified"
      )

      console.log("Solana connection initialized")
    } catch (error) {
      throw new Error(
        `Failed to initialize Solana: ${(error as Error).message}`
      )
    }
  }

  async startAgent(): Promise<void> {
    try {
      if (!this.isInitialized) {
        await this.initialize()
      }

      const mode = await selectMode()
      const agentExecutor = await this.initializeAgent()

      if (mode === "chat") {
        await this.runChatMode(agentExecutor, {})
      } else if (mode === "auto") {
        await this.runAutonomousMode(agentExecutor, {})
      }
    } catch (error) {
      console.error("Failed to start agent:", error)
      await this.cleanup()
      throw error
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.twitterService) {
        await this.twitterService.stopStream()
      }
      if (this.discord) {
        this.discord.destroy()
      }
      this.isInitialized = false
      console.log("Cleanup completed successfully")
    } catch (error) {
      console.error("Error during cleanup:", error)
      throw error
    }
  }

  private async initializeServices(): Promise<void> {
    try {
      await this.socialService.initialize()
      elizaLogger.success("Social service initialized")

      await this.setupMessageHandling()
      elizaLogger.success("Message handling initialized")

      await this.twitterService.startStream()
      elizaLogger.success("Twitter stream initialized")
    } catch (error) {
      elizaLogger.error("Service initialization failed:", error)
      throw error
    }
  }

  private async setupMessageHandling(): Promise<void> {
    this.discord.on("messageCreate", async (message: Message) => {
      if (message.author.bot) return

      try {
        const parsedCommand = Parser.parseCommand(message.content)
        if (!parsedCommand) return

        const command: AgentCommand = {
          ...parsedCommand,
          type: parsedCommand.type,
          raw: message.content,
          command: "",
        }

        await this.handleCommand(command, {
          platform: "discord",
          channelId: message.channel.id,
          messageId: message.id,
          author: message.author.tag,
        })
      } catch (error) {
        elizaLogger.error("Error handling Discord command:", error)
        await message.reply(
          "Sorry, there was an error processing your command."
        )
      }
    })
  }

  private async startAutomation(): Promise<void> {
    await Promise.all([
      this.startContentGeneration(),
      this.startMarketMonitoring(),
      this.startCommunityEngagement(),
    ])

    if (!mainCharacter.settings?.chains) {
      elizaLogger.warn("No tweet chains configured, using default interval")
      const defaultInterval = 1800000 // 30 minutes
      this.scheduleTweets(defaultInterval)
      return
    }

    const tweetChain = Array.isArray(mainCharacter.settings.chains)
      ? mainCharacter.settings.chains.find(
          (chain) => chain.type === "tweet" && chain.enabled
        )
      : mainCharacter.settings.chains.twitter?.[0]

    const tweetInterval = tweetChain?.interval ?? 1800000
    this.scheduleTweets(tweetInterval)
  }

  private scheduleTweets(interval: number): void {
    setInterval(async () => {
      try {
        const marketData = await this.tradingService.getMarketData(
          this.tokenAddress
        )
        await this.postAITweet({
          topic: CONFIG.SOLANA.TOKEN_SETTINGS.SYMBOL,
          price: marketData.price.toString(),
          volume: marketData.volume24h.toString(),
        })
      } catch (error) {
        elizaLogger.error("Error in automated tweet generation:", error)
      }
    }, interval)
  }

  private async startContentGeneration(): Promise<void> {
    const generateAndPost = async () => {
      try {
        const content = await Content.generateContent({
          type: "market_update",
          variables: {
            tokenName: CONFIG.SOLANA.TOKEN_SETTINGS.NAME,
            tokenAddress: this.tokenAddress,
            price: await this.getCurrentPrice(),
          },
        })

        await this.twitterService.sendTweet(content)
      } catch (error) {
        elizaLogger.error("Content generation error:", error)
      }
    }

    await generateAndPost()
    setInterval(generateAndPost, CONFIG.AUTOMATION.CONTENT_GENERATION_INTERVAL)
  }

  private async startMarketMonitoring(): Promise<void> {
    const monitorMarket = async () => {
      try {
        const analysis = await this.analyzeMarket()
        const tradingConfig = CONFIG.SOLANA.TRADING

        if (
          analysis.shouldTrade &&
          analysis.confidence > tradingConfig.MIN_CONFIDENCE
        ) {
          await this.executeTrade(analysis)
        }
      } catch (error) {
        elizaLogger.error("Market monitoring error:", error)
      }
    }

    await monitorMarket()
    setInterval(monitorMarket, CONFIG.AUTOMATION.MARKET_MONITORING_INTERVAL)
  }

  private async startCommunityEngagement(): Promise<void> {
    const engage = async () => {
      try {
        const metrics: SocialMetrics =
          await this.socialService.getCommunityMetrics()
        const content = await Content.generateContent({
          type: "community",
          variables: {
            followers: metrics.followers.toString(),
            engagement: metrics.engagement.toString(),
            activity: metrics.activity,
          },
        })

        await this.socialService.send(content)
      } catch (error) {
        elizaLogger.error("Community engagement error:", error)
      }
    }

    await engage()
    setInterval(engage, CONFIG.AUTOMATION.COMMUNITY_ENGAGEMENT_INTERVAL)
  }

  private async analyzeMarket(): Promise<MarketAnalysis> {
    const marketData = await this.tradingService.getMarketData(
      this.tokenAddress
    )
    const aiAnalysis = await this.aiService.analyzeMarket(marketData)

    return {
      shouldTrade: aiAnalysis.shouldTrade,
      confidence: aiAnalysis.confidence,
      action: aiAnalysis.action,
      metrics: aiAnalysis.metrics,
    }
  }

  private async executeTrade(analysis: MarketAnalysis): Promise<TradeResult> {
    return await this.tradingService.executeTrade(
      analysis.action === "BUY" ? "SOL" : this.tokenAddress,
      analysis.action === "BUY" ? this.tokenAddress : "SOL",
      this.calculateTradeAmount(analysis),
      CONFIG.SOLANA.TRADING.SLIPPAGE
    )
  }

  private async getCurrentPrice(): Promise<number> {
    return await this.tradingService.getTokenPrice(this.tokenAddress)
  }

  private calculateTradeAmount(analysis: MarketAnalysis): number {
    return CONFIG.SOLANA.TRADING.BASE_AMOUNT * analysis.confidence
  }

  private async handleCommand(
    command: AgentCommand,
    context: CommandContext
  ): Promise<void> {
    try {
      const response = await this.generateCommandResponse(command, context)
      await this.socialService.sendMessage(
        context.platform,
        context.messageId,
        response
      )
    } catch (error) {
      elizaLogger.error("Command handling error:", error)
      await this.socialService.sendMessage(
        context.platform,
        context.messageId,
        "Sorry, there was an error processing your command."
      )
    }
  }

  private async generateCommandResponse(
    command: AgentCommand,
    context: CommandContext
  ): Promise<string> {
    switch (command.type) {
      case "price":
        const price = await this.getCurrentPrice()
        return `Current price: ${price} SOL`
      case "stats":
        const metrics = await this.tradingService.getMarketData(
          this.tokenAddress
        )
        return `24h Volume: ${metrics.volume24h}\nMarket Cap: ${metrics.marketCap}`
      default:
        const response = await this.aiService.generateResponse({
          content: command.raw,
          platform: context.platform,
          author: context.author,
        })
        return response
    }
  }

  private async generateTweetContent(context: any = {}): Promise<string> {
    try {
      const prompt = `Generate an engaging tweet about ${
        context.topic || "cryptocurrency"
      } that is informative and entertaining. Include relevant market metrics 
      if available. Max length: 280 characters.`

      const response = await this.runtime.llm.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "mixtral-8x7b-32768",
        max_tokens: 100,
        temperature: 0.7,
      })

      const message = response.choices[0]?.message?.content
      if (!message) {
        throw new Error("Failed to generate tweet content")
      }
      return message.trim()
    } catch (error) {
      elizaLogger.error("Error generating tweet content:", error)
      throw error
    }
  }

  async postAITweet(context: any = {}): Promise<void> {
    try {
      elizaLogger.info("Generating AI tweet...")
      const content = await this.generateTweetContent(context)
      await this.twitterService.sendTweet(content)
      elizaLogger.success("AI tweet posted successfully")
    } catch (error) {
      elizaLogger.error("Failed to post AI tweet:", error)
      throw error
    }
  }
}

// Import required dependencies
import axios from "axios"
import { config as loadConfig } from "dotenv"
import NodeCache from "node-cache"
import { CONFIG } from "./config/settings.js"
import { TokenProvider } from "./providers/token.js"
import { aiService, AIService } from "./services/ai/ai.js"
import {
  JupiterPriceV2Service,
  JupiterService,
} from "./services/blockchain/defi/JupiterPriceV2Service.js"
import { ChatService, Mode } from "./services/chat/index.js"
import { MarketDataProcessor } from "./services/market/data/DataProcessor.js"
import { RedisService } from "./services/market/data/RedisCache.js"
import { WalletProvider } from "./providers/wallet.js"
import { Connection, PublicKey } from "@solana/web3.js"
import { redisService } from "./services/redis/redis-service.js"

loadConfig()

// Export types and functions
export {
  cleanup,
  initializeServices,
  logConfiguration,
  MemeAgentInfluencer,
  selectMode,
  startChat,
  validateEnvironment,
  type AgentCommand,
  type CommandContext,
  type MarketAnalysis,
  type TokenInfo,
  type TradeResult,
}

// Start the application
if (import.meta.url === new URL(process.argv[1], "file:").href) {
  const agent = new MemeAgentInfluencer()
  agent.startAgent().catch((error) => {
    elizaLogger.error("Fatal error:", error)
    process.exit(1)
  })
}
