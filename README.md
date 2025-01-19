# Replicate MCP Server

An MCP server that allows you to interact with Replicate's machine learning models directly through the Model Context Protocol. This server enables AI systems to run models and manage predictions on Replicate without dealing with API implementation details.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/replicate-mcp.git
cd replicate-mcp
```

2. Install dependencies and build:
```bash
yarn install
yarn build
```

3. Configure the server in your Claude Desktop config file (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "replicate": {
      "command": "node",
      "args": [
        "/directory/to/dist/index"
      ],
      "env": {
        "REPLICATE_API_TOKEN": "apiKey"
      }
    }
  }
}
```

Replace `/directory/to/dist/index` with the actual path to your built index.js file, and `apiKey` with your Replicate API token.

## What Can You Do With This Server?

This MCP server provides four main capabilities:

### 1. Run Models Directly

Use the `run_model` tool when you want to quickly run a model and get its results immediately. Simply specify which model you want to use (in the format "owner/model" or "owner/model:version") and provide the required input parameters for that specific model.

### 2. Create Predictions

For longer-running models, use the `create_prediction` tool to start a model run asynchronously. You can optionally set up webhook notifications to track the prediction's progress through different stages (start, output, logs, completion).

### 3. Check Prediction Status

Once you've created a prediction, use the `get_prediction` tool to check its current status and retrieve any available results. Just provide the prediction ID and you'll get back the complete status including any outputs or error messages.

### 4. Cancel Predictions

If you no longer need a prediction to complete, use the `cancel_prediction` tool to stop it and free up resources. This only works for predictions that are still in the "starting" or "processing" state.

## Using the Server

To use this MCP server, you'll need:

1. A Replicate API token set in your environment
2. The model you want to use (in owner/model format)
3. The appropriate input parameters for your chosen model

The server will handle all the communication with Replicate's API, error handling, and response formatting, making it simple to integrate Replicate's capabilities into your AI system.

## Error Handling

The server provides clear error messages when:
- The model path format is incorrect
- Required input parameters are missing
- A prediction fails
- You try to use an unknown tool

Each error response includes a descriptive message to help you understand and fix the issue.
