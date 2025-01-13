import {
  Action,
  ActionHandler,
  IAgentRuntime,
  Memory,
  Plugin,
  State,
} from "@elizaos/core"

export interface SearchResult {
  title: string
  url: string
  snippet: string
  score?: number
  source: "tavily" | "exa"
  metadata?: Record<string, unknown>
}

export interface SearchOptions {
  maxResults?: number
  searchType?: string
  filters?: Record<string, unknown>
}

export interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
}

export interface SearchPluginConfig {
  apiKey: string
  maxResults?: number
  searchType?: string
  filters?: Record<string, unknown>
}

export interface ActionHandler {
  (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean>
}

export interface ActionValidator {
  (runtime: IAgentRuntime, message: Memory): Promise<boolean>
}

export interface CustomAction extends Action {
  name: string
  description: string
  validate: ActionValidator
  handler: ActionHandler
}

export interface SearchPlugin extends Plugin {
  name: string
  description: string
  actions: SearchAction[]
  config: SearchPluginConfig
}

export default CustomAction
