#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
# Set the path to the .env file (in the parent directory of the script)
ENV_FILE="$SCRIPT_DIR/../.env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Source environment variables from .env file
echo "Loading environment variables from $ENV_FILE"
export $(grep -v '^#' "$ENV_FILE" | xargs -0)

# docs: https://github.com/modelcontextprotocol/inspector

# Launch MCP Inspector with the server
npx @modelcontextprotocol/inspector --cli node "dist/index.js" --method tools/list
