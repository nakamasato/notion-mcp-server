# Notion MCP Server

> [!NOTE]
> For local usage with Cursor, Claude Desktop, etc, it's better to use [Official Notion MCP server](https://github.com/makenotion/notion-mcp-server). But as of May 2025, it doesn't support SSE and streamable HTTP at the moment. This repo is to provide notion-mcp-server with SSE and streamable HTTP.

This project implements a Model Context Protocol (MCP) server for the Notion API supporting both Server-Sent Events (SSE) and Streamable HTTP transport mechanisms. It allows AI assistants and other applications to interact with Notion workspaces in a standardized way.

## Features

- Implements the Model Context Protocol (MCP) version 2024-11-05
  - **Server-Sent Events (SSE)**: `/sse`
  - **Streamable HTTP**: `/mcp`
- Provides access to Notion API functionality through MCP tools
- Compatible with Claude, Cursor, and other MCP clients

**Available Tools**: The server exposes the following Notion API capabilities as MCP tools:

- `notion_retrieve_page`: Retrieve a Notion page by ID
- `notion_search`: Search for pages in Notion
- `notion_create_page`: Create a new page in Notion
- `notion_update_page`: Update an existing page in Notion
- `notion_create_comment`: Create a comment on a page or block

## Usage

### Using Docker Image

You can quickly get started with the pre-built Docker image:

1. Create an `.env` file with your Notion credentials:
   ```
   NOTION_TOKEN=your_notion_integration_token
   NOTION_VERSION=2022-06-28
   ```

2. Run the Docker container:
   ```bash
   docker run -p 3000:3000 --env-file .env nakamasato/notion-mcp-server:0.1.3
   ```

3. Configure your MCP client to connect to the server:

   Example: **Cursor AI**:

   ```json
   {
      "mcpServers": {
        "notion": {
            "url": "http://localhost:3000/sse"
        }
      }
   }
   ```

   ![](docs/cursor-mcp.png)

   For more detailed configuration instructions for Claude Desktop, Zed, and other clients, see the [client-config-example.md](client-config-example.md) file.

## Local Run

### Prerequisite

- Node.js 20 or higher
- A Notion integration token (get one from [Notion Integrations](https://www.notion.so/profile/integrations))
- Pages or databases shared with your Notion integration

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/nakamasato/notion-mcp-server.git
   cd notion-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your Notion API credentials as environment variables:
   ```bash
   export NOTION_TOKEN="your_notion_integration_token"
   export NOTION_VERSION="2022-06-28"
   ```

### Running the Server

For development with auto-reload:
```bash
npm run dev
```

For direct TypeScript execution (recommended for local development):
```bash
npx tsx src/index.ts
```

By default, the server runs on port 3000. You can customize this with the `PORT` environment variable.

### Running with Docker

1. Start the server:
```bash
docker compose up
```

To stop the server:
```bash
docker compose down
```

The server will automatically restart unless explicitly stopped.


## Client Configuration

### Cursor


Set `.cursor/mcp.json`

```json
{
   "mcpServers": {
      "notion": {
         "url": "http://localhost:3000/sse"
      }
   }
}
```

![](docs/cursor-mcp.png)

### Python

```py
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client


async def list_tools_with_sse():

    async with sse_client(url="http://localhost:3000/sse", timeout=10, sse_read_timeout=10) as (read_stream, write_stream):

        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            tools = await session.list_tools()

            print(f"Available tools ({len(tools.tools)}):")
            for tool in tools.tools:
                print(f"- name: {tool.name}, description: {tool.description}, schema: {tool.inputSchema}")


if __name__ == "__main__":
    asyncio.run(list_tools_with_sse())
```

```
uv run python tools/mcp_client.py
Available tools (5):
- name: notion_retrieve_page, description: Retrieves a Notion page by its ID, schema: {'type': 'object', 'properties': {'page_id': {'type': 'string', 'description': 'The ID of the page to retrieve'}}, 'required': ['page_id'], 'additionalProperties': False, '$schema': 'http://json-schema.org/draft-07/schema#'}
- name: notion_search, description: Searches for pages in Notion, schema: {'type': 'object', 'properties': {'query': {'type': 'string', 'description': 'The search query'}, 'filter': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'Optional filter for search results'}, 'sort': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'Optional sort for search results'}}, 'required': ['query'], 'additionalProperties': False, '$schema': 'http://json-schema.org/draft-07/schema#'}
- name: notion_create_page, description: Creates a new page in Notion, schema: {'type': 'object', 'properties': {'parent': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'The parent of the page'}, 'properties': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'The properties of the page'}, 'children': {'type': 'array', 'description': 'The content of the page'}}, 'required': ['parent'], 'additionalProperties': False, '$schema': 'http://json-schema.org/draft-07/schema#'}
- name: notion_update_page, description: Updates a page in Notion, schema: {'type': 'object', 'properties': {'page_id': {'type': 'string', 'description': 'The ID of the page to update'}, 'properties': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'The properties to update'}}, 'required': ['page_id', 'properties'], 'additionalProperties': False, '$schema': 'http://json-schema.org/draft-07/schema#'}
- name: notion_create_comment, description: Creates a comment in Notion, schema: {'type': 'object', 'properties': {'parent': {'type': 'object', 'properties': {}, 'additionalProperties': False, 'description': 'The parent of the comment'}, 'rich_text': {'type': 'array', 'description': 'The content of the comment'}}, 'required': ['parent', 'rich_text'], 'additionalProperties': False, '$schema': 'http://json-schema.org/draft-07/schema#'}
```

Read more: [Client Config Examples](client-config-example.md)

## References

- https://www.npmjs.com/package/@modelcontextprotocol/sdk
- https://modelcontextprotocol.io/quickstart/server#node
- https://github.com/modelcontextprotocol/quickstart-resources/tree/main/weather-server-typescript
- https://azukiazusa.dev/blog/mcp-server-streamable-http-transport/
- https://github.com/modelcontextprotocol/typescript-sdk/tree/main/src/examples

## License

MIT
