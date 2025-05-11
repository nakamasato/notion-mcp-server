import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import express from "express";
import https from "https";
import { randomUUID } from "node:crypto";
import { z } from "zod";

dotenv.config();

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_HEADERS = {
    "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
    "Notion-Version": process.env.NOTION_VERSION || "2022-06-28",
    "Content-Type": "application/json"
};

// Helper function for making Notion API requests
async function makeNotionRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            headers: NOTION_HEADERS
        };

        const req = https.request(`${NOTION_API_BASE}${path}`, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new Error(response.message || 'Notion API error'));
                    } else {
                        resolve(response as T);
                    }
                } catch (error) {
                    reject(new Error(`Error parsing Notion API response: ${error instanceof Error ? error.message : String(error)}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Error executing Notion API request: ${error.message}`));
        });

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Create server instance
const server = new McpServer({
    name: "notion",
    version: "1.0.0",
});

// Register Notion tools
server.tool(
    "notion_retrieve_page",
    "Retrieves a Notion page by its ID",
    {
        page_id: z.string().describe("The ID of the page to retrieve")
    },
    async ({ page_id }: { page_id: string }) => {
        const response = await makeNotionRequest(`/pages/${page_id}`, 'GET');
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
);

server.tool(
    "notion_search",
    "Searches for pages in Notion",
    {
        query: z.string().describe("The search query"),
        filter: z.object({}).optional().describe("Optional filter for search results"),
        sort: z.object({}).optional().describe("Optional sort for search results")
    },
    async ({ query, filter, sort }: { query: string; filter?: Record<string, unknown>; sort?: Record<string, unknown> }) => {
        const response = await makeNotionRequest('/search', 'POST', {
            query,
            filter,
            sort
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
);

server.tool(
    "notion_create_page",
    "Creates a new page in Notion",
    {
        parent: z.object({}).describe("The parent of the page"),
        properties: z.object({}).optional().describe("The properties of the page"),
        children: z.array(z.any()).optional().describe("The content of the page")
    },
    async ({ parent, properties, children }: { parent: Record<string, unknown>; properties?: Record<string, unknown>; children?: unknown[] }) => {
        const response = await makeNotionRequest('/pages', 'POST', {
            parent,
            properties,
            children
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
);

server.tool(
    "notion_update_page",
    "Updates a page in Notion",
    {
        page_id: z.string().describe("The ID of the page to update"),
        properties: z.object({}).describe("The properties to update")
    },
    async ({ page_id, properties }: { page_id: string; properties: Record<string, unknown> }) => {
        const response = await makeNotionRequest(`/pages/${page_id}`, 'PATCH', {
            properties
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
);

server.tool(
    "notion_create_comment",
    "Creates a comment in Notion",
    {
        parent: z.object({}).describe("The parent of the comment"),
        rich_text: z.array(z.any()).describe("The content of the comment")
    },
    async ({ parent, rich_text }: { parent: Record<string, unknown>; rich_text: unknown[] }) => {
        const response = await makeNotionRequest('/comments', 'POST', {
            parent,
            rich_text
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(response, null, 2)
                }
            ]
        };
    }
);

// Start the server
async function main() {
    if (!process.env.NOTION_TOKEN) {
        console.error('NOTION_TOKEN must be set');
        process.exit(1);
    }

    const app = express();
    app.use(express.json());

    // Maps to store transports by session ID
    const streamableTransports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    const sseTransports: { [sessionId: string]: SSEServerTransport } = {};

    //=============================================================================
    // DEPRECATED HTTP+SSE TRANSPORT (PROTOCOL VERSION 2024-11-05)
    //=============================================================================

    app.get('/sse', async (req: express.Request, res: express.Response) => {
        console.log('Received GET request to /sse (deprecated SSE transport)');
        const transport = new SSEServerTransport('/messages', res);
        sseTransports[transport.sessionId] = transport;
        res.on("close", () => {
            delete sseTransports[transport.sessionId];
        });
        await server.connect(transport);
    });

    app.post("/messages", async (req: express.Request, res: express.Response) => {
        const sessionId = req.query.sessionId as string;
        const transport = sseTransports[sessionId];
        if (transport) {
            await transport.handlePostMessage(req, res, req.body);
        } else {
            res.status(400).send('No transport found for sessionId');
        }
    });

    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req: express.Request, res: express.Response) => {
        // Check for existing session ID
        console.log("req.headers", req.headers);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let transport: StreamableHTTPServerTransport;

        if (sessionId && streamableTransports[sessionId]) {
            // Reuse existing transport
            transport = streamableTransports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
            // New initialization request
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sessionId) => {
                    // Store the transport by session ID
                    streamableTransports[sessionId] = transport;
                }
            });

            // Clean up transport when closed
            transport.onclose = () => {
                if (transport.sessionId) {
                    delete streamableTransports[transport.sessionId];
                }
            };

            // Connect to the MCP server
            await server.connect(transport);
        } else {
            // Invalid request
            res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32000,
                    message: 'Bad Request: No valid session ID provided',
                },
                id: null,
            });
            return;
        }

        // Handle the request
        await transport.handleRequest(req, res, req.body);
    });

    // Reusable handler for GET and DELETE requests
    const handleSessionRequest = async (req: express.Request, res: express.Response) => {
        console.log("handleSessionRequest", req.headers);
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !streamableTransports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }

        const transport = streamableTransports[sessionId];
        await transport.handleRequest(req, res);
    };

    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', handleSessionRequest);

    // Handle DELETE requests for session termination
    app.delete('/mcp', handleSessionRequest);

    const port = parseInt(process.env.PORT || '3000');
    app.listen(port, '0.0.0.0', () => {
        console.error(`Notion MCP Server running on http://0.0.0.0:${port}/mcp`);
    });
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
