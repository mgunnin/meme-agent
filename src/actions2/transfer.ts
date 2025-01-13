import { elizaLogger, settings } from "@elizaos/core"

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js"

import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@/utils/spl-token"
import {
  ActionExample,
  composeContext,
  Content,
  generateObjectDeprecated,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State,
  type Action,
} from "@elizaos/core"
import { getWalletKey } from "../utils/keypairUtils.js"

export interface TransferContent extends Content {
  tokenAddress: string
  recipient: string
  amount: string | number
}

function isTransferContent(
  runtime: IAgentRuntime,
  content: any
): content is TransferContent {
  console.log("Content for transfer", content)
  return (
    typeof content.tokenAddress === "string" &&
    typeof content.recipient === "string" &&
    (typeof content.amount === "string" || typeof content.amount === "number")
  )
}

const transferTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "tokenAddress": "BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump",
    "recipient": "9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
    "amount": "1000"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token transfer:
- Token contract address
- Recipient wallet address
- Amount to transfer

Respond with a JSON markdown block containing only the extracted values.`

export default {
  name: "SEND_TOKEN",
  similes: [
    "TRANSFER_TOKEN",
    "TRANSFER_TOKENS",
    "SEND_TOKENS",
    "SEND_SOL",
    "PAY",
  ],
  validate: async (runtime: IAgentRuntime, message: Memory) => {
    console.log("Validating transfer from user:", message.userId)
    //add custom validate logic here
    /*
            const adminIds = runtime.getSetting("ADMIN_USER_IDS")?.split(",") || [];
            //console.log("Admin IDs from settings:", adminIds);

            const isAdmin = adminIds.includes(message.userId);

            if (isAdmin) {
                //console.log(`Authorized transfer from user: ${message.userId}`);
                return true;
            }
            else
            {
                //console.log(`Unauthorized transfer attempt from user: ${message.userId}`);
                return false;
            }
            */
    return false
  },
  description: "Transfer tokens from the agent's wallet to another address",
  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<boolean> => {
    elizaLogger.log("Starting SEND_TOKEN handler...")

    // Initialize or update state
    if (!state) {
      state = (await runtime.composeState(message)) as State
    } else {
      state = await runtime.updateRecentMessageState(state)
    }

    // Compose transfer context
    const transferContext = composeContext(runtime, {
      content: message.content,
      message,
    })

    // Generate transfer content
    const content = await generateObjectDeprecated({
      runtime,
      context: transferContext,
      modelClass: ModelClass.LARGE,
    })

    // Validate transfer content
    if (!isTransferContent(runtime, content)) {
      console.error("Invalid content for TRANSFER_TOKEN action.")
      if (callback) {
        callback(runtime, {
          text: "Unable to process transfer request. Invalid content provided.",
          content: { error: "Invalid transfer content" },
        })
      }
      return false
    }

    try {
      const { keypair: senderKeypair } = await getWalletKey(runtime, true, {
        requirePrivateKey: true,
        keyPath: "",
      })
      if (!senderKeypair) {
        throw new Error("Sender keypair is undefined")
      }

      const connection = new Connection(settings.RPC_URL!)

      const mintPubkey = new PublicKey(content.tokenAddress)
      const recipientPubkey = new PublicKey(content.recipient)

      // Get decimals (simplest way)
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey)
      const decimals =
        (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 9

      // Adjust amount with decimals
      const adjustedAmount = BigInt(
        Number(content.amount) * Math.pow(10, decimals)
      )
      console.log(
        `Transferring: ${content.amount} tokens (${adjustedAmount} base units)`
      )

      // Rest of the existing working code...
      const senderATA = getAssociatedTokenAddress(
        mintPubkey,
        senderKeypair.publicKey
      )
      const recipientATA = getAssociatedTokenAddress(
        mintPubkey,
        recipientPubkey
      )

      const instructions: TransactionInstruction[] = []

      const recipientATAInfo = await connection.getAccountInfo(
        await recipientATA
      )
      if (!recipientATAInfo) {
        const createAtaIx = createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey,
          await recipientATA,
          recipientPubkey,
          mintPubkey
        )
        if (createAtaIx instanceof Transaction) {
          instructions.push(...createAtaIx.instructions)
        } else {
          instructions.push(createAtaIx)
        }
      }

      const transferIx = createTransferInstruction(
        await senderATA,
        await recipientATA,
        senderKeypair.publicKey,
        adjustedAmount,
        [], // p0 argument
        PublicKey.default // TOKEN_PROGRAM_ID argument, replace with actual program ID if available
      )
      if (transferIx instanceof Transaction) {
        instructions.push(...transferIx.instructions)
      } else {
        instructions.push(transferIx)
      }

      // Create and sign versioned transaction
      const messageV0 = new TransactionMessage({
        payerKey: senderKeypair.publicKey,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions,
      }).compileToV0Message()

      const transaction = new VersionedTransaction(messageV0)
      transaction.sign([senderKeypair])

      // Send transaction
      const signature = await connection.sendTransaction(transaction)

      console.log("Transfer successful:", signature)

      if (callback) {
        callback(runtime, {
          text: "Transfer action completed",
          content: message.content,
        })
      }

      return true
    } catch (error) {
      console.error("Error during token transfer:", error)
      if (callback) {
        callback(runtime, {
          text: `Error transferring tokens: ${(error as Error).message}`,
          content: { error: (error as Error).message },
        })
      }
      return false
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Send 69 EZSIS BieefG47jAHCGZBxi2q87RDuHyGZyYC3vAzxpyu8pump to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "I'll send 69 EZSIS tokens now...",
          action: "SEND_TOKEN",
        },
      },
      {
        user: "{{user2}}",
        content: {
          text: "Successfully sent 69 EZSIS tokens to 9jW8FPr6BSSsemWPV22UUCzSqkVdTp6HTyPqeqyuBbCa\nTransaction: 5KtPn3DXXzHkb7VAVHZGwXJQqww39ASnrf7YkyJoF2qAGEpBEEGvRHLnnTG8ZVwKqNHMqSckWVGnsQAgfH5pbxEb",
        },
      },
    ],
  ] as ActionExample[][],
} as Action
