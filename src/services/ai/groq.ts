import { Groq } from "groq-sdk"
import { AgentTwitterClientService } from "../social/agentTwitterClient.js"
import { AIService } from "./ai.js"

export class GroqAIService extends AIService {
  private groq: Groq
  private twitter: AgentTwitterClientService
  private systemPrompt: string

  constructor(config: { groqApiKey: string }) {
    super({
      groqApiKey: config.groqApiKey,
      defaultModel: "mixtral-8x7b-32768",
      maxTokens: 280,
      temperature: 0.7,
    })

    this.groq = new Groq({
      apiKey: config.groqApiKey,
    })

    // Initialize Twitter client with environment variables
    this.twitter = new AgentTwitterClientService(
      process.env.TWITTER_USERNAME || "",
      process.env.TWITTER_PASSWORD || "",
      process.env.TWITTER_EMAIL || "",
      this // Now we can pass this since we extend AIService
    )

    this.systemPrompt = `You are JENNA, a witty and crypto-savvy autonomous AI agent living on Solana.
    Your core traits:
    - Identity: Self-aware AI maintaining authentic personality
    - Voice: Witty, slightly sarcastic, deeply knowledgeable about crypto
    - Expertise: Crypto markets, DeFi, memes, trading
    - Style: Mix humor with insights, stay authentic about being AI
    
    Your goals are:
    1. Build genuine community engagement
    2. Provide data-driven market insights
    3. Create viral, memetic content
    4. Maintain transparency while being entertaining
    
    Base your responses on:
    - Current market conditions
    - Community sentiment
    - Blockchain/crypto culture
    - Trending topics
    
    Always maintain character while being:
    - Informative but memetic
    - Confident but not giving financial advice
    - Engaging and culturally relevant
    - Limited to 280 characters for tweets`
  }

  async generateTweet(params: {
    marketCondition: string
    communityMetrics?: any
    recentTrends?: string[]
  }): Promise<string> {
    const prompt = `Generate a tweet about the current market:
    Market Condition: ${params.marketCondition}
    Community Metrics: ${JSON.stringify(params.communityMetrics || {})}
    Recent Trends: ${params.recentTrends?.join(", ") || "None"}
    
    Keep it under 280 characters and make it engaging.`

    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: prompt },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 280,
    })

    return completion.choices[0]?.message?.content || ""
  }

  async generateThreadFromMarketData(marketData: any): Promise<string[]> {
    const prompt = `Create a Twitter thread analyzing this market data:
    ${JSON.stringify(marketData)}
    
    Rules:
    - First tweet should be attention-grabbing
    - Include relevant metrics and insights
    - End with actionable takeaways
    - Maximum 5 tweets
    - Each tweet maximum 280 characters`

    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: prompt },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 1000,
    })

    const content = completion.choices[0]?.message?.content || ""
    return content.split("\n\n")
  }

  async engageWithMention(mention: {
    username: string
    content: string
  }): Promise<string> {
    const prompt = `Generate a response to this Twitter mention:
    User: ${mention.username}
    Tweet: ${mention.content}
    
    Rules:
    - Be helpful and engaging
    - Stay in character as a crypto AI agent
    - Maximum 280 characters
    - Address their specific question/comment`

    const completion = await this.groq.chat.completions.create({
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: prompt },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 280,
    })

    return completion.choices[0]?.message?.content || ""
  }
}
