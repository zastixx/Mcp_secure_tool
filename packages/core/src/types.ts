import { z } from 'zod';

// JSON Schema type
export type JSONSchema = {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: JSONSchema;
  [key: string]: any;
};

// Tool Pattern Definition
export const ToolPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['api', 'file', 'database', 'notification', 'processing', 'auth']),
  description: z.string(),
  actions: z.array(z.string()),
  dependencies: z.array(z.string()),
  template: z.string(),
  inputSchema: z.record(z.any()),
  outputSchema: z.record(z.any()),
  examples: z.array(z.string()).optional()
});

export type ToolPattern = z.infer<typeof ToolPatternSchema>;

// Integration Configuration
export const IntegrationConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
  configSchema: z.record(z.any()),
  setupInstructions: z.string(),
  authType: z.enum(['api-key', 'oauth', 'basic', 'none']).optional(),
  environmentVariables: z.array(z.string()).optional()
});

export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

// Generated Tool Definition
export const GeneratedToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  pattern: z.string(),
  parameters: z.record(z.any()),
  code: z.string(),
  dependencies: z.array(z.string())
});

export type GeneratedTool = z.infer<typeof GeneratedToolSchema>;

// Server Configuration
export const ServerConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string().default('1.0.0'),
  language: z.enum(['typescript', 'javascript', 'python']).default('typescript'),
  tools: z.array(GeneratedToolSchema),
  integrations: z.array(IntegrationConfigSchema),
  dependencies: z.array(z.string()),
  environmentVariables: z.record(z.string()).optional(),
  deploymentConfig: z.record(z.any()).optional()
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// AI Analysis Result
export const AIAnalysisSchema = z.object({
  intent: z.string(),
  toolRequirements: z.array(z.object({
    type: z.string(),
    description: z.string(),
    actions: z.array(z.string()),
    priority: z.number()
  })),
  integrations: z.array(z.object({
    service: z.string(),
    reason: z.string(),
    confidence: z.number()
  })),
  complexity: z.enum(['simple', 'moderate', 'complex']),
  suggestedName: z.string(),
  suggestedDescription: z.string()
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

// Template Context for code generation
export interface TemplateContext {
  serverConfig: ServerConfig;
  tools: GeneratedTool[];
  integrations: IntegrationConfig[];
  packageName: string;
  dependencies: string[];
  environmentVariables: Record<string, string>;
  timestamp: string;
  [key: string]: any;
}

// Error types
export class MCPGenerationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPGenerationError';
  }
}

export class AIAnalysisError extends MCPGenerationError {
  constructor(message: string, details?: any) {
    super(message, 'AI_ANALYSIS_ERROR', details);
  }
}

export class TemplateError extends MCPGenerationError {
  constructor(message: string, details?: any) {
    super(message, 'TEMPLATE_ERROR', details);
  }
}

export class ValidationError extends MCPGenerationError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}