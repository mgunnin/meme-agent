import { IAgentRuntime, Memory, State } from "@elizaos/core"

export class AgentCoordinationService {
  private runtime: IAgentRuntime

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime
  }

  async processMessage(message: Memory, state?: State): Promise<void> {
    const { roomId, userId } = message
    if (!roomId || !userId) {
      throw new Error("Message must have roomId and userId")
    }

    // Process message logic here
  }

  async getParticipants(roomId: string): Promise<string[]> {
    return this.runtime.databaseAdapter.getParticipantsForRoom(roomId)
  }
}

export default AgentCoordinationService
