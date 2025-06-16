import OpenAI from 'openai';
import { ServerConfig, ToolPattern, IntegrationConfig, GeneratedTool } from './types';
import { TOOL_PATTERNS } from './patterns';
import { INTEGRATIONS, findIntegrations } from './integrations';

export class AIGenerator {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Main entry point: Generate complete server configuration from description
   */
  async generateServerConfig(description: string): Promise<ServerConfig> {
    try {
      // Step 1: Analyze the user's requirements
      const analysis = await this.analyzeRequiredTools(description);
      
      // Step 2: Select matching tool patterns
      const toolPatterns = this.selectToolPatterns(analysis);
      
      // Step 3: Select required integrations
      const integrations = this.selectIntegrations(analysis);
      
      // Step 4: Generate custom tools based on analysis
      const customTools = await this.generateCustomTools(analysis, toolPatterns);
      
      // Step 5: Create complete server configuration
      const serverConfig: ServerConfig = {
        name: this.generateServerName(analysis),
        description: analysis.summary || description,
        patterns: toolPatterns,
        integrations,
        customTools,
        dependencies: this.calculateDependencies(toolPatterns, integrations),
        environmentVariables: this.generateEnvironmentVariables(integrations),
        metadata: {
          generatedAt: new Date().toISOString(),
          aiAnalysis: analysis,
          originalDescription: description
        }
      };

      return serverConfig;
    } catch (error) {
      throw new Error(`AI Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze user description to understand requirements
   */
  private async analyzeRequiredTools(description: string): Promise<any> {
    const prompt = `
You are an expert at analyzing software requirements and identifying needed tools and integrations.

Analyze this user description and provide a structured analysis:
"${description}"

Please provide a JSON response with the following structure:
{
  "summary": "Brief summary of what the user wants to build",
  "primaryActions": ["action1", "action2", "action3"],
  "dataTypes": ["data type 1", "data type 2"],
  "services": ["service 1", "service 2"],
  "complexity": "simple|moderate|complex",
  "toolCategories": ["api", "file", "database", "notification", "auth"],
  "suggestedIntegrations": ["github", "slack", "postgresql"],
  "keyFeatures": ["feature 1", "feature 2"],
  "estimatedTools": 3
}

Focus on:
1. What actions the user wants to perform (get, create, update, delete, send, etc.)
2. What services they want to integrate with (GitHub, Slack, databases, etc.)
3. What type of data they'll be working with
4. The complexity level of their requirements

Respond only with valid JSON.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a technical requirements analyst. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('No response from AI');
      }

      return JSON.parse(response);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      // Fallback to basic analysis
      return this.createFallbackAnalysis(description);
    }
  }

  /**
   * Select appropriate tool patterns based on analysis
   */
  private selectToolPatterns(analysis: any): ToolPattern[] {
    const selectedPatterns: ToolPattern[] = [];
    const categories = analysis.toolCategories || [];
    const actions = analysis.primaryActions || [];

    // Match patterns based on categories
    for (const category of categories) {
      const matchingPatterns = TOOL_PATTERNS.filter(pattern => 
        pattern.category === category
      );
      selectedPatterns.push(...matchingPatterns);
    }

    // Match patterns based on actions
    for (const action of actions) {
      const matchingPatterns = TOOL_PATTERNS.filter(pattern =>
        pattern.actions.some(patternAction => 
          patternAction.toLowerCase().includes(action.toLowerCase()) ||
          action.toLowerCase().includes(patternAction.toLowerCase())
        )
      );
      selectedPatterns.push(...matchingPatterns);
    }

    // Remove duplicates
    const uniquePatterns = selectedPatterns.filter((pattern, index, self) =>
      index === self.findIndex(p => p.id === pattern.id)
    );

    // Ensure we have at least one pattern
    if (uniquePatterns.length === 0) {
      uniquePatterns.push(TOOL_PATTERNS[0]); // Default to first pattern
    }

    return uniquePatterns.slice(0, 5); // Limit to 5 patterns max
  }

  /**
   * Select appropriate integrations based on analysis
   */
  private selectIntegrations(analysis: any): IntegrationConfig[] {
    const selectedIntegrations: IntegrationConfig[] = [];
    const suggestedIntegrations = analysis.suggestedIntegrations || [];
    const services = analysis.services || [];

    // Match by suggested integrations
    for (const integrationId of suggestedIntegrations) {
      const integration = INTEGRATIONS.find(i => i.id === integrationId);
      if (integration) {
        selectedIntegrations.push(integration);
      }
    }

    // Match by service names
    for (const service of services) {
      const matchingIntegrations = findIntegrations(service);
      selectedIntegrations.push(...matchingIntegrations);
    }

    // Remove duplicates
    const uniqueIntegrations = selectedIntegrations.filter((integration, index, self) =>
      index === self.findIndex(i => i.id === integration.id)
    );

    return uniqueIntegrations.slice(0, 3); // Limit to 3 integrations max
  }

  /**
   * Generate custom tools based on specific requirements
   */
  private async generateCustomTools(analysis: any, patterns: ToolPattern[]): Promise<GeneratedTool[]> {
    const customTools: GeneratedTool[] = [];

    for (const pattern of patterns) {
      try {
        const customTool = await this.generateCustomTool(analysis, pattern);
        if (customTool) {
          customTools.push(customTool);
        }
      } catch (error) {
        console.warn(`Failed to generate custom tool for pattern ${pattern.id}:`, error);
      }
    }

    return customTools;
  }

  /**
   * Generate a single custom tool based on pattern and analysis
   */
  private async generateCustomTool(analysis: any, pattern: ToolPattern): Promise<GeneratedTool | null> {
    const prompt = `
Generate a custom MCP tool implementation based on this pattern and requirements.

Pattern: ${pattern.name} (${pattern.id})
Pattern Actions: ${pattern.actions.join(', ')}
User Requirements: ${analysis.summary}
Key Features: ${(analysis.keyFeatures || []).join(', ')}

Create a tool that:
1. Follows the ${pattern.name} pattern
2. Implements the user's specific requirements
3. Has a clear name and description
4. Includes proper input/output schemas

Provide a JSON response with:
{
  "name": "tool_name",
  "description": "What this tool does",
  "inputSchema": {
    "type": "object",
    "properties": { ... },
    "required": [ ... ]
  },
  "outputSchema": {
    "type": "object",
    "properties": { ... }
  },
  "implementation": "// TypeScript implementation code"
}

The implementation should be production-ready TypeScript code.
    `;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert TypeScript developer specializing in MCP tools. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        return null;
      }

      const toolData = JSON.parse(response);
      return {
        id: `${pattern.id}_${Date.now()}`,
        patternId: pattern.id,
        name: toolData.name,
        description: toolData.description,
        inputSchema: toolData.inputSchema,
        outputSchema: toolData.outputSchema,
        implementation: toolData.implementation,
        dependencies: pattern.dependencies
      };
    } catch (error) {
      console.error(`Error generating custom tool for pattern ${pattern.id}:`, error);
      return null;
    }
  }

  /**
   * Generate a server name based on analysis
   */
  private generateServerName(analysis: any): string {
    const summary = analysis.summary || 'MCP Server';
    const words = summary.split(' ').slice(0, 3); // Take first 3 words
    return words
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '-mcp-server';
  }

  /**
   * Calculate all required dependencies
   */
  private calculateDependencies(patterns: ToolPattern[], integrations: IntegrationConfig[]): string[] {
    const dependencies = new Set<string>();

    // Add MCP core dependencies
    dependencies.add('@modelcontextprotocol/sdk');
    dependencies.add('zod');

    // Add pattern dependencies
    for (const pattern of patterns) {
      pattern.dependencies.forEach(dep => dependencies.add(dep));
    }

    // Add integration dependencies
    for (const integration of integrations) {
      integration.dependencies.forEach(dep => dependencies.add(dep));
    }

    return Array.from(dependencies);
  }

  /**
   * Generate environment variables configuration
   */
  private generateEnvironmentVariables(integrations: IntegrationConfig[]): Record<string, string> {
    const envVars: Record<string, string> = {};

    for (const integration of integrations) {
      const schema = integration.configSchema;
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          const envKey = `${integration.id.toUpperCase()}_${key.toUpperCase()}`;
          const envValue = (prop as any).description || `${integration.displayName} ${key}`;
          envVars[envKey] = envValue;
        }
      }
    }

    return envVars;
  }

  /**
   * Create fallback analysis when AI fails
   */
  private createFallbackAnalysis(description: string): any {
    const lowerDesc = description.toLowerCase();
    const analysis: any = {
      summary: description.slice(0, 100) + (description.length > 100 ? '...' : ''),
      primaryActions: [],
      dataTypes: [],
      services: [],
      complexity: 'simple',
      toolCategories: [],
      suggestedIntegrations: [],
      keyFeatures: [],
      estimatedTools: 1
    };

    // Basic keyword matching
    if (lowerDesc.includes('github')) {
      analysis.services.push('GitHub');
      analysis.suggestedIntegrations.push('github');
      analysis.toolCategories.push('api');
    }

    if (lowerDesc.includes('slack')) {
      analysis.services.push('Slack');
      analysis.suggestedIntegrations.push('slack');
      analysis.toolCategories.push('notification');
    }

    if (lowerDesc.includes('database') || lowerDesc.includes('sql')) {
      analysis.toolCategories.push('database');
      analysis.suggestedIntegrations.push('postgresql');
    }

    if (lowerDesc.includes('file') || lowerDesc.includes('upload')) {
      analysis.toolCategories.push('file');
    }

    if (lowerDesc.includes('email')) {
      analysis.suggestedIntegrations.push('sendgrid');
      analysis.toolCategories.push('notification');
    }

    // Default to API tools if nothing else matches
    if (analysis.toolCategories.length === 0) {
      analysis.toolCategories.push('api');
    }

    return analysis;
  }
}