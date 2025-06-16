import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';
import { ServerConfig, GeneratedTool, IntegrationConfig } from './types';

export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Generate complete MCP server from configuration
   */
  async generateServer(config: ServerConfig, outputDir: string): Promise<void> {
    // Ensure output directory exists
    await fs.ensureDir(outputDir);
    await fs.ensureDir(path.join(outputDir, 'src'));
    await fs.ensureDir(path.join(outputDir, 'src', 'tools'));
    await fs.ensureDir(path.join(outputDir, 'src', 'integrations'));

    // Generate main server files
    await this.generateServerIndex(config, outputDir);
    await this.generatePackageJson(config, outputDir);
    await this.generateTsConfig(outputDir);
    await this.generateToolsIndex(config, outputDir);
    await this.generateEnvFile(config, outputDir);
    await this.generateReadme(config, outputDir);

    // Generate individual tool files
    await this.generateToolFiles(config, outputDir);

    // Generate integration files
    await this.generateIntegrationFiles(config, outputDir);

    // Generate types file
    await this.generateTypesFile(config, outputDir);
  }

  /**
   * Generate main server index file
   */
  private async generateServerIndex(config: ServerConfig, outputDir: string): Promise<void> {
    const template = `
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Import generated tools
{{#each customTools}}
import { {{camelCase name}}Tool } from './tools/{{kebabCase name}}.js';
{{/each}}

// Import integrations
{{#each integrations}}
import { {{camelCase name}}Integration } from './integrations/{{kebabCase name}}.js';
{{/each}}

class {{pascalCase name}}Server {
  private server: Server;
  
  {{#each integrations}}
  private {{camelCase name}}: {{pascalCase name}}Integration;
  {{/each}}

  constructor() {
    this.server = new Server(
      {
        name: '{{name}}',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize integrations
    {{#each integrations}}
    this.{{camelCase name}} = new {{pascalCase name}}Integration();
    {{/each}}

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {{#each customTools}}
          {
            name: '{{kebabCase name}}',
            description: '{{description}}',
            inputSchema: {{{stringify inputSchema}}},
          },
          {{/each}}
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          {{#each customTools}}
          case '{{kebabCase name}}':
            return await {{camelCase name}}Tool(args{{#if ../integrations}}, {
              {{#each ../integrations}}
              {{camelCase name}}: this.{{camelCase name}},
              {{/each}}
            }{{/if}});
          {{/each}}
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              \`Unknown tool: \${name}\`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(
          ErrorCode.InternalError,
          \`Error executing tool \${name}: \${errorMessage}\`
        );
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('{{name}} running on stdio');
  }
}

const server = new {{pascalCase name}}Server();
server.run().catch(console.error);
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled(config);
    
    await fs.writeFile(path.join(outputDir, 'src', 'index.ts'), result);
  }

  /**
   * Generate package.json
   */
  private async generatePackageJson(config: ServerConfig, outputDir: string): Promise<void> {
    const packageJson = {
      name: config.name,
      version: '1.0.0',
      description: config.description,
      type: 'module',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        dev: 'tsc --watch',
        start: 'node dist/index.js',
        clean: 'rm -rf dist'
      },
      dependencies: config.dependencies.reduce((acc, dep) => {
        acc[dep] = 'latest';
        return acc;
      }, {} as Record<string, string>),
      devDependencies: {
        '@types/node': '^20.0.0',
        'typescript': '^5.0.0'
      }
    };

    await fs.writeFile(
      path.join(outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  /**
   * Generate TypeScript configuration
   */
  private async generateTsConfig(outputDir: string): Promise<void> {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ES2020',
        moduleResolution: 'node',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: './dist',
        rootDir: './src',
        declaration: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    await fs.writeFile(
      path.join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  /**
   * Generate tools index file
   */
  private async generateToolsIndex(config: ServerConfig, outputDir: string): Promise<void> {
    const template = `
// Export all generated tools
{{#each customTools}}
export { {{camelCase name}}Tool } from './{{kebabCase name}}.js';
{{/each}}

// Tool types
export interface ToolContext {
  {{#each integrations}}
  {{camelCase name}}: {{pascalCase name}}Integration;
  {{/each}}
}
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled(config);
    
    await fs.writeFile(path.join(outputDir, 'src', 'tools', 'index.ts'), result);
  }

  /**
   * Generate environment file
   */
  private async generateEnvFile(config: ServerConfig, outputDir: string): Promise<void> {
    const envVars = config.integrations
      .flatMap(integration => integration.envVars || [])
      .map(envVar => `${envVar}=`)
      .join('\n');

    const envContent = `# Environment variables for ${config.name}
# Copy this file to .env and fill in your values

${envVars}
`;

    await fs.writeFile(path.join(outputDir, '.env.example'), envContent);
  }

  /**
   * Generate README file
   */
  private async generateReadme(config: ServerConfig, outputDir: string): Promise<void> {
    const template = `# {{name}}

{{description}}

## Installation

\`\`\`bash
npm install
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and configure your environment variables:

\`\`\`bash
cp .env.example .env
\`\`\`

## Development

\`\`\`bash
# Build the project
npm run build

# Run in development mode
npm run dev

# Start the server
npm start
\`\`\`

## Available Tools

{{#each customTools}}
### {{name}}

{{description}}

**Input Schema:**
\`\`\`json
{{{stringify inputSchema}}}
\`\`\`

{{/each}}

## Integrations

{{#each integrations}}
### {{name}}

{{description}}

{{#if envVars}}
**Required Environment Variables:**
{{#each envVars}}
- \`{{this}}\`
{{/each}}
{{/if}}

{{/each}}
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled(config);
    
    await fs.writeFile(path.join(outputDir, 'README.md'), result);
  }

  /**
   * Generate individual tool files
   */
  private async generateToolFiles(config: ServerConfig, outputDir: string): Promise<void> {
    for (const tool of config.customTools) {
      await this.generateToolFile(tool, config, outputDir);
    }
  }

  /**
   * Generate a single tool file
   */
  private async generateToolFile(tool: GeneratedTool, config: ServerConfig, outputDir: string): Promise<void> {
    const template = `
import { z } from 'zod';
{{#if integrations}}
import { ToolContext } from './index.js';
{{/if}}

// Input validation schema
const {{camelCase name}}Schema = z.object({{{stringify inputSchema.properties}}});

/**
 * {{description}}
 */
export async function {{camelCase name}}Tool(
  args: unknown{{#if ../integrations}},
  context: ToolContext{{/if}}
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // Validate input
  const validatedArgs = {{camelCase name}}Schema.parse(args);

  try {
    {{#if implementation}}
    {{{implementation}}}
    {{else}}
    // TODO: Implement {{name}} tool logic
    const result = {
      message: "{{name}} tool executed successfully",
      args: validatedArgs
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
    {{/if}}
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: "text",
          text: \`Error in {{name}} tool: \${errorMessage}\`
        }
      ]
    };
  }
}
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled({ ...tool, integrations: config.integrations });
    
    const fileName = this.kebabCase(tool.name) + '.ts';
    await fs.writeFile(path.join(outputDir, 'src', 'tools', fileName), result);
  }

  /**
   * Generate integration files
   */
  private async generateIntegrationFiles(config: ServerConfig, outputDir: string): Promise<void> {
    for (const integration of config.integrations) {
      await this.generateIntegrationFile(integration, outputDir);
    }
  }

  /**
   * Generate a single integration file
   */
  private async generateIntegrationFile(integration: IntegrationConfig, outputDir: string): Promise<void> {
    const template = `
{{#if envVars}}
// Load environment variables
{{#each envVars}}
const {{constantCase this}} = process.env.{{this}};
{{/each}}
{{/if}}

/**
 * {{description}}
 */
export class {{pascalCase name}}Integration {
  {{#if envVars}}
  {{#each envVars}}
  private {{camelCase this}}: string;
  {{/each}}
  {{/if}}

  constructor() {
    {{#if envVars}}
    {{#each envVars}}
    this.{{camelCase this}} = {{constantCase this}} || '';
    if (!this.{{camelCase this}}) {
      throw new Error('{{this}} environment variable is required');
    }
    {{/each}}
    {{/if}}
  }

  {{#if methods}}
  {{#each methods}}
  /**
   * {{description}}
   */
  async {{name}}({{#if parameters}}{{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}): Promise<{{returnType}}> {
    {{#if implementation}}
    {{{implementation}}}
    {{else}}
    // TODO: Implement {{name}} method
    throw new Error('{{name}} method not implemented');
    {{/if}}
  }

  {{/each}}
  {{else}}
  /**
   * Example method - replace with actual integration methods
   */
  async exampleMethod(): Promise<string> {
    return 'Integration {{name}} is ready';
  }
  {{/if}}
}
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled(integration);
    
    const fileName = this.kebabCase(integration.name) + '.ts';
    await fs.writeFile(path.join(outputDir, 'src', 'integrations', fileName), result);
  }

  /**
   * Generate types file
   */
  private async generateTypesFile(config: ServerConfig, outputDir: string): Promise<void> {
    const template = `
// Generated types for {{name}}

{{#each customTools}}
export interface {{pascalCase name}}Args {
{{#each inputSchema.properties}}
  {{@key}}: {{#if this.type}}{{this.type}}{{else}}any{{/if}};
{{/each}}
}

{{/each}}

{{#each integrations}}
{{#if methods}}
{{#each methods}}
export interface {{pascalCase ../name}}{{pascalCase name}}Params {
  {{#each parameters}}
  {{name}}: {{type}};
  {{/each}}
}

{{/each}}
{{/if}}
{{/each}}

// Server configuration type
export interface ServerConfig {
  name: string;
  description: string;
  dependencies: string[];
  customTools: GeneratedTool[];
  integrations: IntegrationConfig[];
}

export interface GeneratedTool {
  name: string;
  description: string;
  inputSchema: any;
  implementation?: string;
}

export interface IntegrationConfig {
  name: string;
  description: string;
  envVars?: string[];
  methods?: Array<{
    name: string;
    description: string;
    parameters?: Array<{
      name: string;
      type: string;
    }>;
    returnType: string;
    implementation?: string;
  }>;
}
`;

    const compiled = this.handlebars.compile(template);
    const result = compiled(config);
    
    await fs.writeFile(path.join(outputDir, 'src', 'types.ts'), result);
  }

  /**
   * Register Handlebars helpers
   */
  private registerHelpers(): void {
    // Convert to camelCase
    this.handlebars.registerHelper('camelCase', (str: string) => {
      return this.camelCase(str);
    });

    // Convert to PascalCase
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      return this.pascalCase(str);
    });

    // Convert to kebab-case
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      return this.kebabCase(str);
    });

    // Convert to CONSTANT_CASE
    this.handlebars.registerHelper('constantCase', (str: string) => {
      return this.constantCase(str);
    });

    // Stringify JSON with proper formatting
    this.handlebars.registerHelper('stringify', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });
  }

  /**
   * Helper functions for string transformations
   */
  private camelCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^[A-Z]/, c => c.toLowerCase());
  }

  private pascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^[a-z]/, c => c.toUpperCase());
  }

  private kebabCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }

  private constantCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toUpperCase();
  }
}