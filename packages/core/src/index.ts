import { TemplateEngine } from './template-engine.js';
import { ServerConfig, GeneratedTool, IntegrationConfig } from './types.js';

// Re-export types for external use
export { ServerConfig, GeneratedTool, IntegrationConfig } from './types.js';
export { TemplateEngine } from './template-engine.js';

/**
 * Main generator class that orchestrates MCP server generation
 */
export class MCPServerGenerator {
  private templateEngine: TemplateEngine;

  constructor() {
    this.templateEngine = new TemplateEngine();
  }

  /**
   * Generate a complete MCP server from configuration
   */
  async generateServer(config: ServerConfig, outputDir: string): Promise<void> {
    console.log(`Generating MCP server "${config.name}" in ${outputDir}...`);
    
    try {
      await this.templateEngine.generateServer(config, outputDir);
      console.log('✅ Server generation completed successfully!');
      console.log('\nNext steps:');
      console.log(`1. cd ${outputDir}`);
      console.log('2. npm install');
      console.log('3. Copy .env.example to .env and configure your environment variables');
      console.log('4. npm run build');
      console.log('5. npm start');
    } catch (error) {
      console.error('❌ Server generation failed:', error);
      throw error;
    }
  }

  /**
   * Create a basic server configuration template
   */
  createBasicConfig(name: string, description: string): ServerConfig {
    return {
      name: this.sanitizeName(name),
      description,
      dependencies: [
        '@modelcontextprotocol/sdk',
        'zod'
      ],
      customTools: [],
      integrations: []
    };
  }

  /**
   * Add a tool to the server configuration
   */
  addTool(config: ServerConfig, tool: GeneratedTool): ServerConfig {
    return {
      ...config,
      customTools: [...config.customTools, tool]
    };
  }

  /**
   * Add an integration to the server configuration
   */
  addIntegration(config: ServerConfig, integration: IntegrationConfig): ServerConfig {
    return {
      ...config,
      integrations: [...config.integrations, integration]
    };
  }

  /**
   * Add a dependency to the server configuration
   */
  addDependency(config: ServerConfig, dependency: string): ServerConfig {
    return {
      ...config,
      dependencies: [...new Set([...config.dependencies, dependency])]
    };
  }

  /**
   * Create a simple tool configuration
   */
  createTool(
    name: string,
    description: string,
    inputSchema: any,
    implementation?: string
  ): GeneratedTool {
    return {
      name: this.sanitizeName(name),
      description,
      inputSchema: {
        type: 'object',
        properties: inputSchema,
        required: Object.keys(inputSchema)
      },
      implementation
    };
  }

  /**
   * Create a simple integration configuration
   */
  createIntegration(
    name: string,
    description: string,
    envVars?: string[],
    methods?: IntegrationConfig['methods']
  ): IntegrationConfig {
    return {
      name: this.sanitizeName(name),
      description,
      envVars,
      methods
    };
  }

  /**
   * Validate server configuration
   */
  validateConfig(config: ServerConfig): string[] {
    const errors: string[] = [];

    // Validate basic properties
    if (!config.name?.trim()) {
      errors.push('Server name is required');
    }

    if (!config.description?.trim()) {
      errors.push('Server description is required');
    }

    // Validate tools
    config.customTools.forEach((tool, index) => {
      if (!tool.name?.trim()) {
        errors.push(`Tool at index ${index} is missing a name`);
      }

      if (!tool.description?.trim()) {
        errors.push(`Tool "${tool.name}" is missing a description`);
      }

      if (!tool.inputSchema) {
        errors.push(`Tool "${tool.name}" is missing input schema`);
      }
    });

    // Validate integrations
    config.integrations.forEach((integration, index) => {
      if (!integration.name?.trim()) {
        errors.push(`Integration at index ${index} is missing a name`);
      }

      if (!integration.description?.trim()) {
        errors.push(`Integration "${integration.name}" is missing a description`);
      }

      // Check for duplicate names
      const toolNames = config.customTools.map(t => t.name.toLowerCase());
      const integrationNames = config.integrations.map(i => i.name.toLowerCase());
      
      if (toolNames.length !== new Set(toolNames).size) {
        errors.push('Duplicate tool names detected');
      }

      if (integrationNames.length !== new Set(integrationNames).size) {
        errors.push('Duplicate integration names detected');
      }
    });

    return errors;
  }

  /**
   * Generate server with validation
   */
  async generateValidatedServer(config: ServerConfig, outputDir: string): Promise<void> {
    const errors = this.validateConfig(config);
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    await this.generateServer(config, outputDir);
  }

  /**
   * Sanitize name for use in file names and identifiers
   */
  private sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}

/**
 * Create a new MCP server generator instance
 */
export function createGenerator(): MCPServerGenerator {
  return new MCPServerGenerator();
}

/**
 * Quick generation function for simple use cases
 */
export async function generateMCPServer(
  name: string,
  description: string,
  outputDir: string,
  options: {
    tools?: GeneratedTool[];
    integrations?: IntegrationConfig[];
    dependencies?: string[];
  } = {}
): Promise<void> {
  const generator = createGenerator();
  
  let config = generator.createBasicConfig(name, description);
  
  // Add tools
  if (options.tools) {
    options.tools.forEach(tool => {
      config = generator.addTool(config, tool);
    });
  }
  
  // Add integrations
  if (options.integrations) {
    options.integrations.forEach(integration => {
      config = generator.addIntegration(config, integration);
    });
  }
  
  // Add dependencies
  if (options.dependencies) {
    options.dependencies.forEach(dep => {
      config = generator.addDependency(config, dep);
    });
  }
  
  await generator.generateValidatedServer(config, outputDir);
}

// Export default instance for convenience
export default createGenerator();