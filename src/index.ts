#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Replicate, { WebhookEventType } from "replicate";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Initialize Replicate client
const replicate = new Replicate();

// Type for model path format
type ModelPath = `${string}/${string}` | `${string}/${string}:${string}`;

// Schema definitions with refined types
const RunModelArgsSchema = z.object({
  model: z.custom<ModelPath>((val) => {
    if (typeof val !== 'string') return false;
    return /^[^/]+\/[^/:]+(?::[^/]+)?$/.test(val);
  }, 'Model must be in format "owner/model" or "owner/model:version"'),
  input: z.record(z.any()),
});

const GetPredictionArgsSchema = z.object({
  id: z.string(),
});

const CancelPredictionArgsSchema = z.object({
  id: z.string(),
});

const CreatePredictionArgsSchema = z.object({
  model: z.custom<ModelPath>((val) => {
    if (typeof val !== 'string') return false;
    return /^[^/]+\/[^/:]+(?::[^/]+)?$/.test(val);
  }, 'Model must be in format "owner/model" or "owner/model:version"'),
  input: z.record(z.any()),
  webhook: z.string().optional(),
  webhook_events_filter: z.array(z.custom<WebhookEventType>()).optional(),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Server setup
const server = new Server(
  {
    name: "replicate-server",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "run_model",
        description:
          "Run a model on Replicate and get its output directly. This is a synchronous operation " +
          "that waits for the model to complete. Use this when you want to run a model and get " +
          "results immediately. Model must be in format 'owner/model' or 'owner/model:version'. " +
          "Input parameters are specific to the model being run.",
        inputSchema: zodToJsonSchema(RunModelArgsSchema) as ToolInput,
      },
      {
        name: "create_prediction",
        description:
          "Create a new prediction asynchronously. This starts the model run but returns immediately " +
          "with a prediction ID. Model must be in format 'owner/model' or 'owner/model:version'. " +
          "Optionally configure webhooks for status updates with events: 'start', 'output', 'logs', " +
          "or 'completed'. Use this for long-running models or when you want to handle the prediction " +
          "lifecycle manually.",
        inputSchema: zodToJsonSchema(CreatePredictionArgsSchema) as ToolInput,
      },
      {
        name: "get_prediction",
        description:
          "Get the current status and results of a prediction by its ID. Use this to check if an " +
          "async prediction has completed and get its output. Returns the full prediction object " +
          "including status, output, and any error messages.",
        inputSchema: zodToJsonSchema(GetPredictionArgsSchema) as ToolInput,
      },
      {
        name: "cancel_prediction",
        description:
          "Cancel a running prediction by its ID. Use this to stop predictions that are no longer " +
          "needed, saving compute resources. Only predictions in 'starting' or 'processing' state " +
          "can be canceled.",
        inputSchema: zodToJsonSchema(CancelPredictionArgsSchema) as ToolInput,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "run_model": {
        const parsed = RunModelArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for run_model: ${parsed.error}`);
        }
        const { model, input } = parsed.data;
        const output = await replicate.run(model as ModelPath, { input });
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        };
      }

      case "create_prediction": {
        const parsed = CreatePredictionArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for create_prediction: ${parsed.error}`);
        }
        const { model, input, webhook, webhook_events_filter } = parsed.data;
        const prediction = await replicate.predictions.create({
          model: model as ModelPath,
          input,
          webhook,
          webhook_events_filter,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(prediction, null, 2) }],
        };
      }

      case "get_prediction": {
        const parsed = GetPredictionArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for get_prediction: ${parsed.error}`);
        }
        const prediction = await replicate.predictions.get(parsed.data.id);
        return {
          content: [{ type: "text", text: JSON.stringify(prediction, null, 2) }],
        };
      }

      case "cancel_prediction": {
        const parsed = CancelPredictionArgsSchema.safeParse(args);
        if (!parsed.success) {
          throw new Error(`Invalid arguments for cancel_prediction: ${parsed.error}`);
        }
        await replicate.predictions.cancel(parsed.data.id);
        return {
          content: [{ type: "text", text: `Successfully canceled prediction ${parsed.data.id}` }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Replicate MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
