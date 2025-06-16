#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { logger } from "./utils/logger.js";
import { validateToolInput } from "./utils/validation.js";

// Import tool modules
// import { ExampleTools } from "./tools/example.js"; // <-- Replace/add your tool modules here

// Import integration modules
// import { ExampleIntegration } from "./integrations/example.js"; // <-- Replace/add your integration modules here

const SERVER_NAME = "{{serverName}}";
const SERVER_VERSION = "{{serverVersion}}";

class MCPServer {
  private server: Server;
  private tools: Map<string, any> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupHandlers();
  }

  private setupTools() {
    // Initialize tool modules
    {{#each toolModules}}
    const {{camelCase name}} = new {{name}}Tools();
  private setupTools() {
    // Initialize tool modules
    // Example:
    // const example = new ExampleTools();
    // example.getTools().forEach(tool => {
    //   this.tools.set(tool.name, { module: example, tool });
    // });

    logger.info(`Loaded ${this.tools.size} tools`);
  }
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.tools.has(name)) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool "${name}" not found`
        );
      }

      const { module, tool } = this.tools.get(name)!;

      try {
        // Validate input
        const validatedArgs = validateToolInput(tool.inputSchema, args);
        
        // Execute tool
        const result = await module.executeTool(name, validatedArgs);
        
        logger.info(`Tool "${name}" executed successfully`);
        
        return {
          content: [
            {
              type: "text",
              text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
        
      } catch (error) {
        logger.error(`Tool "${name}" execution failed:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info(`${SERVER_NAME} v${SERVER_VERSION} started`);
  }
}

// Start the server
const server = new MCPServer();
server.start().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Shutting down server...");
  process.exit(0);
});