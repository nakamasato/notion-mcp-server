# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Notion MCP Server is a Model Context Protocol (MCP) server for the Notion API supporting both Server-Sent Events (SSE) and Streamable HTTP as transport mechanisms. It allows AI assistants and other applications to interact with Notion workspaces in a standardized way.

## Commands

### Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start with auto-reload for development
npm run dev

# Run in Docker
docker-compose up -d
```

### Environment Variables

Set up your Notion API credentials in one of two ways:

```bash
# Option 1: Using NOTION_TOKEN and NOTION_VERSION
export NOTION_TOKEN="your_notion_integration_token"
export NOTION_VERSION="2022-06-28"

# Option 2: Using OPENAPI_MCP_HEADERS
export OPENAPI_MCP_HEADERS='{"Authorization": "Bearer your_notion_integration_token", "Notion-Version": "2022-06-28"}'
```

## Architecture

### Key Components

1. **Server Setup (src/index.ts)**
   - Express.js server that handles both SSE connections and JSON-RPC messages
   - Implements Model Context Protocol (MCP) version 2024-11-05
   - Supports both SSE and Streamable HTTP transport protocols
   - Provides access to Notion API functionality through MCP tools

2. **Connection Management**
   - Uses a Map to store active SSE connections with unique client IDs
   - Manages connection lifecycle with keep-alive messages
   - Handles client disconnections

3. **MCP Protocol Implementation**
   - `/sse` endpoint for establishing SSE connections
   - `/messages` endpoint for receiving JSON-RPC requests from clients via SSE
   - `/mcp` endpoint for Streamable HTTP transport
   - Supports standard MCP methods: `mcp/initialize`, `mcp/listTools`, `mcp/callTool`

4. **Notion API Integration**
   - Maps MCP tool calls to Notion API endpoints
   - Formats curl commands to execute Notion API requests
   - Handles authentication via environment variables

### MCP Tools Provided

- `notion_retrieve_page`: Retrieve a Notion page by ID
- `notion_search`: Search for pages in Notion
- `notion_create_page`: Create a new page in Notion
- `notion_update_page`: Update an existing page in Notion
- `notion_create_comment`: Create a comment on a page or block

## Client Configuration

The server is compatible with various MCP clients, including:

- Claude Desktop
- Cursor AI
- Cline
- Zed
- Custom MCP clients

The server supports two connection methods:
- Server-Sent Events (SSE): `/sse` and `/messages`
- Streamable HTTP: `/mcp`

Detailed configuration examples for these clients can be found in the `client-config-example.md` file.
