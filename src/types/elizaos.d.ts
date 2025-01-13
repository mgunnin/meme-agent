declare module "@elizaos/core" {
  export const elizaLogger: {
    info: (message: string, ...args: any[]) => void
    success: (message: string, ...args: any[]) => void
    warn: (message: string, ...args: any[]) => void
    error: (message: string, ...args: any[]) => void
    log: (message: string, ...args: any[]) => void
  }

  export interface IAgentRuntime {
    getSetting(key: string): string | undefined
    setSetting(key: string, value: string): void
    getState(): Record<string, any>
    setState(state: Record<string, any>): void
    llm?: any
    composeState(message: any): Promise<any>
    updateRecentMessageState(state: any): Promise<any>
    cacheManager: ICacheManager
    databaseAdapter: IDatabaseAdapter
    character: Character
    modelProvider?: string
  }

  export interface Character {
    name: string
    description: string
    systemPrompt: string
    plugins?: string[] | any[]
    settings?: Record<string, any>
    chains?: Record<string, any>[]
    clients?: any[]
    id?: string
    modelProvider?: string
  }

  export interface ICacheManager {
    get<T>(key: string): Promise<T | null | undefined>
    set(key: string, value: any, options?: { expires?: number }): Promise<void>
    del(key: string): Promise<void>
  }

  export interface IDatabaseAdapter {
    db: any
    getAccountById(id: string): Promise<any>
    getParticipantsForRoom(roomId: string): Promise<string[]>
  }

  export const defaultCharacter: Character

  export function validateCharacterConfig(config: Character): void

  export enum ModelClass {
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large",
  }

  export enum ModelProviderName {
    OPENROUTER = "openrouter",
    GROQ = "groq",
    ANTHROPIC = "anthropic",
  }

  export enum Clients {
    TWITTER = "twitter",
    DISCORD = "discord",
    TELEGRAM = "telegram",
  }

  export class AgentRuntime implements IAgentRuntime {
    getSetting(key: string): string | undefined
    setSetting(key: string, value: string): void
    getState(): Record<string, any>
    setState(state: Record<string, any>): void
    llm?: any
    composeState(message: any): Promise<any>
    updateRecentMessageState(state: any): Promise<any>
    cacheManager: ICacheManager
    databaseAdapter: IDatabaseAdapter
    character: Character
  }

  export function stringToUuid(str: string): string

  export interface Action {
    name: string
    type?: string
    similes?: string[]
    validate?: (runtime: IAgentRuntime, message: Memory) => Promise<boolean>
    description?: string
    handler?: (
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      options?: Record<string, unknown>,
      callback?: HandlerCallback
    ) => Promise<boolean>
    examples?: ActionExample[][]
  }

  export interface ActionExample {
    user?: string
    type?: string
    description?: string
    example?: string
    content?: {
      text?: string
      action?: string
      inputTokenSymbol?: string
      outputTokenSymbol?: string
      amount?: number
      tokenInfo?: {
        symbol?: string
        address?: string
        creator?: string
        name?: string
        description?: string
      }
    }
  }

  export interface Content {
    text: string
    type?: string
  }

  export interface HandlerCallback {
    (runtime: IAgentRuntime, message: any): Promise<any>
  }

  export interface Memory {
    type: string
    content: any
    userId?: string
    agentId?: string
    roomId?: string
    content?: {
      text?: string
      content?: any
    }
  }

  export interface ModelClass {
    new (...args: any[]): any
  }

  export interface State {
    [key: string]: any
  }

  export interface Provider {
    name: string
    initialize(): Promise<void>
    get?(runtime: IAgentRuntime, message: Memory, state?: State): Promise<any>
  }

  export interface Evaluator {
    name: string
    evaluate(runtime: IAgentRuntime, message: any): Promise<boolean>
  }

  export const settings: {
    [key: string]: any
  }

  export interface GenerateOptions {
    runtime: IAgentRuntime
    context?: string | Promise<string>
    modelClass?: ModelClass
  }

  export function generateImage(
    options: GenerateOptions
  ): Promise<{ data: string[] }>
  export function generateText(options: GenerateOptions): Promise<string>
  export function generateObject(options: GenerateOptions): Promise<any>
  export function generateObjectDeprecated(
    options: GenerateOptions
  ): Promise<any>
  export function generateObjectArray(options: GenerateOptions): Promise<any[]>
  export function generateTrueOrFalse(
    options: GenerateOptions
  ): Promise<boolean>
  export function composeContext(
    runtime: IAgentRuntime,
    message: any
  ): Promise<string>
  export const booleanFooter: string

  export interface Plugin {
    name: string
    initialize(): Promise<void>
  }

  export interface Handler {
    name: string
    handle(runtime: IAgentRuntime, message: any): Promise<any>
  }

  export interface Validator {
    name: string
    validate(runtime: IAgentRuntime, message: any): Promise<boolean>
  }

  export class MemoryManager {
    constructor(runtime: IAgentRuntime)
    get(key: string): Promise<any>
    set(key: string, value: any): Promise<void>
  }
}
