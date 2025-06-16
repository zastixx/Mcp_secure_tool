import { ToolPattern } from './types';

/**
 * Library of pre-defined tool patterns that can be matched to user requirements
 */
export const TOOL_PATTERNS: ToolPattern[] = [
  // API Request Tools
  {
    id: 'api-request',
    name: 'API Request Tool',
    category: 'api',
    description: 'Make HTTP requests to REST APIs',
    actions: ['get', 'post', 'put', 'delete', 'patch', 'request'],
    dependencies: ['axios', 'zod'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'API endpoint URL' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      headers: { type: 'object', description: 'HTTP headers' },
      data: { type: 'object', description: 'Request body data' }
    },
    required: ['url']
  },
  handler: async (args: any) => {
    const { url, method = 'GET', headers = {}, data } = args;
    
    try {
      const response = await axios({
        url,
        method,
        headers,
        data
      });
      
      return {
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error: any) {
      return {
        error: error.message,
        status: error.response?.status
      };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        method: { type: 'string' },
        headers: { type: 'object' },
        data: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'number' },
        data: { type: 'object' },
        headers: { type: 'object' }
      }
    },
    examples: ['fetch data from API', 'post to webhook', 'REST API calls']
  },

  // File Operations
  {
    id: 'file-operations',
    name: 'File Operations Tool',
    category: 'file',
    description: 'Read, write, and manipulate files',
    actions: ['read', 'write', 'delete', 'list', 'copy', 'move', 'exists'],
    dependencies: ['fs-extra', 'path'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['read', 'write', 'delete', 'list', 'copy', 'move', 'exists'] },
      path: { type: 'string', description: 'File or directory path' },
      content: { type: 'string', description: 'Content to write (for write action)' },
      destination: { type: 'string', description: 'Destination path (for copy/move)' }
    },
    required: ['action', 'path']
  },
  handler: async (args: any) => {
    const { action, path: filePath, content, destination } = args;
    
    try {
      switch (action) {
        case 'read':
          return { content: await fs.readFile(filePath, 'utf8') };
        case 'write':
          await fs.writeFile(filePath, content);
          return { success: true };
        case 'delete':
          await fs.remove(filePath);
          return { success: true };
        case 'list':
          return { files: await fs.readdir(filePath) };
        case 'copy':
          await fs.copy(filePath, destination);
          return { success: true };
        case 'move':
          await fs.move(filePath, destination);
          return { success: true };
        case 'exists':
          return { exists: await fs.pathExists(filePath) };
        default:
          throw new Error(\`Unknown action: \${action}\`);
      }
    } catch (error: any) {
      return { error: error.message };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        path: { type: 'string' },
        content: { type: 'string' },
        destination: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        files: { type: 'array' },
        success: { type: 'boolean' },
        exists: { type: 'boolean' },
        error: { type: 'string' }
      }
    },
    examples: ['read files', 'write data to file', 'manage directories', 'file system operations']
  },

  // Database Operations
  {
    id: 'database-query',
    name: 'Database Query Tool',
    category: 'database',
    description: 'Execute database queries and operations',
    actions: ['query', 'insert', 'update', 'delete', 'select'],
    dependencies: ['pg', 'mysql2', 'sqlite3'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'SQL query to execute' },
      params: { type: 'array', description: 'Query parameters' },
      database: { type: 'string', description: 'Database connection name' }
    },
    required: ['query']
  },
  handler: async (args: any) => {
    const { query, params = [], database = 'default' } = args;
    
    try {
      // Database connection logic would be implemented here
      // This is a template - actual implementation depends on database type
      const result = await executeQuery(query, params, database);
      
      return {
        rows: result.rows || result,
        rowCount: result.rowCount || result.length,
        fields: result.fields
      };
    } catch (error: any) {
      return { error: error.message };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        params: { type: 'array' },
        database: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        rows: { type: 'array' },
        rowCount: { type: 'number' },
        fields: { type: 'array' },
        error: { type: 'string' }
      }
    },
    examples: ['run SQL queries', 'database operations', 'data retrieval']
  },

  // Notification Tools
  {
    id: 'notification-sender',
    name: 'Notification Sender Tool',
    category: 'notification',
    description: 'Send notifications via email, Slack, or other channels',
    actions: ['send', 'email', 'slack', 'webhook', 'sms'],
    dependencies: ['nodemailer', '@slack/web-api', 'twilio'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: ['email', 'slack', 'webhook', 'sms'] },
      recipient: { type: 'string', description: 'Recipient (email, channel, phone)' },
      message: { type: 'string', description: 'Message content' },
      subject: { type: 'string', description: 'Subject (for email)' },
      channel: { type: 'string', description: 'Slack channel' }
    },
    required: ['type', 'recipient', 'message']
  },
  handler: async (args: any) => {
    const { type, recipient, message, subject, channel } = args;
    
    try {
      switch (type) {
        case 'email':
          // Email sending logic
          return { success: true, messageId: 'email-id' };
        case 'slack':
          // Slack sending logic
          return { success: true, ts: 'message-timestamp' };
        case 'webhook':
          // Webhook sending logic
          return { success: true, status: 200 };
        case 'sms':
          // SMS sending logic
          return { success: true, sid: 'message-sid' };
        default:
          throw new Error(\`Unknown notification type: \${type}\`);
      }
    } catch (error: any) {
      return { error: error.message };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        recipient: { type: 'string' },
        message: { type: 'string' },
        subject: { type: 'string' },
        channel: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        messageId: { type: 'string' },
        ts: { type: 'string' },
        status: { type: 'number' },
        sid: { type: 'string' },
        error: { type: 'string' }
      }
    },
    examples: ['send emails', 'slack notifications', 'SMS alerts', 'webhook calls']
  },

  // Data Processing
  {
    id: 'data-processing',
    name: 'Data Processing Tool',
    category: 'processing',
    description: 'Transform, filter, and process data',
    actions: ['transform', 'filter', 'map', 'reduce', 'sort', 'group'],
    dependencies: ['lodash', 'moment', 'csv-parser'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      data: { type: 'array', description: 'Input data array' },
      operation: { type: 'string', enum: ['filter', 'map', 'sort', 'group', 'transform'] },
      config: { type: 'object', description: 'Operation configuration' }
    },
    required: ['data', 'operation']
  },
  handler: async (args: any) => {
    const { data, operation, config = {} } = args;
    
    try {
      switch (operation) {
        case 'filter':
          // Implement filtering logic
          return { result: data.filter(item => /* filter logic */ true) };
        case 'map':
          // Implement mapping logic
          return { result: data.map(item => /* transform logic */ item) };
        case 'sort':
          // Implement sorting logic
          return { result: data.sort() };
        case 'group':
          // Implement grouping logic
          return { result: {} };
        case 'transform':
          // Implement transformation logic
          return { result: data };
        default:
          throw new Error(\`Unknown operation: \${operation}\`);
      }
    } catch (error: any) {
      return { error: error.message };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'array' },
        operation: { type: 'string' },
        config: { type: 'object' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'array' },
        error: { type: 'string' }
      }
    },
    examples: ['process arrays', 'transform data', 'filter results', 'data manipulation']
  },

  // Authentication
  {
    id: 'auth-handler',
    name: 'Authentication Handler',
    category: 'auth',
    description: 'Handle authentication and authorization',
    actions: ['login', 'logout', 'verify', 'refresh', 'oauth'],
    dependencies: ['jsonwebtoken', 'bcrypt', 'passport'],
    template: `
export const {{toolName}} = {
  name: '{{name}}',
  description: '{{description}}',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['login', 'logout', 'verify', 'refresh', 'oauth'] },
      credentials: { type: 'object', description: 'Authentication credentials' },
      token: { type: 'string', description: 'JWT token or access token' }
    },
    required: ['action']
  },
  handler: async (args: any) => {
    const { action, credentials, token } = args;
    
    try {
      switch (action) {
        case 'login':
          // Login logic
          return { success: true, token: 'jwt-token', user: {} };
        case 'logout':
          // Logout logic
          return { success: true };
        case 'verify':
          // Token verification logic
          return { valid: true, user: {} };
        case 'refresh':
          // Token refresh logic
          return { token: 'new-jwt-token' };
        case 'oauth':
          // OAuth flow logic
          return { authUrl: 'oauth-url', state: 'state-token' };
        default:
          throw new Error(\`Unknown auth action: \${action}\`);
      }
    } catch (error: any) {
      return { error: error.message };
    }
  }
};`,
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        credentials: { type: 'object' },
        token: { type: 'string' }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        token: { type: 'string' },
        user: { type: 'object' },
        valid: { type: 'boolean' },
        authUrl: { type: 'string' },
        state: { type: 'string' },
        error: { type: 'string' }
      }
    },
    examples: ['user authentication', 'JWT tokens', 'OAuth flows', 'login systems']
  }
];

/**
 * Find tool patterns that match given keywords/actions
 */
export function findMatchingPatterns(keywords: string[], actions: string[] = []): ToolPattern[] {
  const allKeywords = [...keywords, ...actions].map(k => k.toLowerCase());
  
  return TOOL_PATTERNS.filter(pattern => {
    // Check if any pattern actions match
    const actionMatch = pattern.actions.some(action => 
      allKeywords.some(keyword => 
        action.toLowerCase().includes(keyword) || keyword.includes(action.toLowerCase())
      )
    );
    
    // Check if pattern examples match
    const exampleMatch = pattern.examples?.some(example =>
      allKeywords.some(keyword => 
        example.toLowerCase().includes(keyword) || keyword.includes(example.toLowerCase())
      )
    );
    
    // Check category match
    const categoryMatch = allKeywords.includes(pattern.category.toLowerCase());
    
    return actionMatch || exampleMatch || categoryMatch;
  });
}

/**
 * Get all available tool categories
 */
export function getToolCategories(): string[] {
  return [...new Set(TOOL_PATTERNS.map(p => p.category))];
}

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: string): ToolPattern[] {
  return TOOL_PATTERNS.filter(p => p.category === category);
}