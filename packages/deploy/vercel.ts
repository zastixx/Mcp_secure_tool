// packages/deploy/src/vercel.ts
import { writeFile, mkdir, readFile } from 'fs-extra';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { DeploymentAdapter, DeploymentConfig, DeploymentResult } from './types';

const execAsync = promisify(exec);

export interface VercelConfig extends DeploymentConfig {
  projectName: string;
  teamId?: string;
  framework?: 'nextjs' | 'express' | 'nuxtjs' | null;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  devCommand?: string;
  environment?: Record<string, string>;
  regions?: string[];
  functions?: Record<string, {
    runtime?: string;
    maxDuration?: number;
  }>;
}

export class VercelAdapter implements DeploymentAdapter {
  private apiToken: string;
  private apiUrl = 'https://api.vercel.com';

  constructor(private config: VercelConfig) {
    this.apiToken = process.env.VERCEL_TOKEN || '';
    if (!this.apiToken) {
      throw new Error('VERCEL_TOKEN environment variable is required');
    }
  }

  async deploy(projectPath: string): Promise<DeploymentResult> {
    try {
      console.log('🚀 Preparing Vercel deployment...');
      
      // 1. Create Vercel-specific files
      await this.createVercelFiles(projectPath);
      
      // 2. Build the project
      await this.buildProject(projectPath);
      
      // 3. Deploy to Vercel
      const deploymentInfo = await this.deployToVercel(projectPath);
      
      return {
        success: true,
        url: deploymentInfo.url,
        logs: deploymentInfo.logs,
        metadata: {
          projectName: this.config.projectName,
          deploymentId: deploymentInfo.deploymentId,
          teamId: this.config.teamId
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
        logs: []
      };
    }
  }

  private async createVercelFiles(projectPath: string): Promise<void> {
    // Create Vercel configuration
    const vercelConfig = {
      name: this.config.projectName,
      version: 2,
      framework: this.config.framework,
      buildCommand: this.config.buildCommand || 'npm run build',
      outputDirectory: this.config.outputDirectory || 'dist',
      installCommand: this.config.installCommand || 'npm install',
      devCommand: this.config.devCommand || 'npm run dev',
      env: this.config.environment || {},
      regions: this.config.regions || ['iad1'],
      functions: {
        'api/**/*.ts': {
          runtime: 'nodejs18.x',
          maxDuration: 30
        },
        ...this.config.functions
      },
      rewrites: [
        {
          source: '/mcp/(.*)',
          destination: '/api/mcp'
        }
      ]
    };

    await writeFile(
      join(projectPath, 'vercel.json'),
      JSON.stringify(vercelConfig, null, 2)
    );

    // Create API directory structure
    const apiDir = join(projectPath, 'api');
    await mkdir(apiDir, { recursive: true });

    // Create main API handler
    const apiHandler = `
import { VercelRequest, VercelResponse } from '@vercel/node';
import { MCPServer } from '../src/index';

let server: MCPServer | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Initialize server if not already done
    if (!server) {
      server = new MCPServer();
      await server.initialize();
    }

    // Handle MCP requests
    const result = await server.handleRequest(req.body);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
`;

    await writeFile(join(apiDir, 'mcp.ts'), apiHandler);

    // Create health check endpoint
    const healthHandler = `
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
}
`;

    await writeFile(join(apiDir, 'health.ts'), healthHandler);

    // Update package.json for Vercel
    const packageJsonPath = join(projectPath, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'vercel-build': 'npm run build',
      'dev': 'vercel dev'
    };

    // Add Vercel-specific dependencies
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      '@vercel/node': '^3.0.0',
      'vercel': '^32.0.0'
    };

    await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Create .vercelignore
    const vercelIgnore = `
.env
.env.local
.env.*.local
node_modules
.git
*.log
.DS_Store
coverage
.nyc_output
dist
build
.next
.vercel
`;

    await writeFile(join(projectPath, '.vercelignore'), vercelIgnore.trim());
  }

  private async buildProject(projectPath: string): Promise<void> {
    console.log('📦 Building project for Vercel...');
    
    // Install dependencies including Vercel CLI
    await execAsync('npm install', { cwd: projectPath });
    
    // Build TypeScript
    await execAsync('npm run build', { cwd: projectPath });
  }

  private async deployToVercel(projectPath: string): Promise<{
    deploymentId: string;
    url: string;
    logs: string[];
  }> {
    const logs: string[] = [];
    
    try {
      // Check if Vercel CLI is available
      try {
        await execAsync('vercel --version', { cwd: projectPath });
      } catch (error) {
        // Install Vercel CLI locally if not available
        await execAsync('npm install -g vercel', { cwd: projectPath });
        logs.push('Installed Vercel CLI');
      }

      // Login to Vercel (using token)
      process.env.VERCEL_TOKEN = this.apiToken;
      
      // Deploy to Vercel
      const deployCommand = [
        'vercel',
        '--prod',
        '--yes',
        '--token', this.apiToken
      ];

      if (this.config.teamId) {
        deployCommand.push('--scope', this.config.teamId);
      }

      logs.push('Starting Vercel deployment...');
      
      const { stdout, stderr } = await execAsync(
        deployCommand.join(' '),
        { cwd: projectPath }
      );

      if (stderr) {
        logs.push(`Deployment warnings: ${stderr}`);
      }

      // Extract deployment URL from output
      const urlMatch = stdout.match(/https:\/\/[^\s]+/);
      const deploymentUrl = urlMatch ? urlMatch[0] : '';

      if (!deploymentUrl) {
        throw new Error('Could not extract deployment URL from Vercel output');
      }

      logs.push(`Deployment successful: ${deploymentUrl}`);

      // Get deployment info via API
      const deploymentInfo = await this.getDeploymentInfo(deploymentUrl);

      return {
        deploymentId: deploymentInfo.id,
        url: deploymentUrl,
        logs
      };
    } catch (error) {
      logs.push(`Deployment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  private async getDeploymentInfo(url: string): Promise<{ id: string; state: string }> {
    try {
      const deploymentId = url.split('/').pop()?.split('.')[0] || '';
      
      const response = await axios.get(
        `${this.apiUrl}/v13/deployments/${deploymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.uid,
        state: response.data.state
      };
    } catch (error) {
      console.warn('Could not get deployment info:', error);
      return { id: 'unknown', state: 'unknown' };
    }
  }

  async undeploy(): Promise<DeploymentResult> {
    try {
      console.log(`🗑️  Removing Vercel project ${this.config.projectName}...`);
      
      // Get project info
      const projectResponse = await axios.get(
        `${this.apiUrl}/v9/projects/${this.config.projectName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: this.config.teamId ? { teamId: this.config.teamId } : {}
        }
      );

      // Delete the project
      await axios.delete(
        `${this.apiUrl}/v9/projects/${this.config.projectName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: this.config.teamId ? { teamId: this.config.teamId } : {}
        }
      );

      return {
        success: true,
        logs: [`Project ${this.config.projectName} deleted successfully`]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        logs: []
      };
    }
  }

  async getLogs(): Promise<string[]> {
    try {
      // Get recent deployments
      const deploymentsResponse = await axios.get(
        `${this.apiUrl}/v6/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            projectId: this.config.projectName,
            limit: 1,
            ...(this.config.teamId ? { teamId: this.config.teamId } : {})
          }
        }
      );

      const deployments = deploymentsResponse.data.deployments;
      if (!deployments || deployments.length === 0) {
        return ['No deployments found'];
      }

      const latestDeployment = deployments[0];
      
      // Get deployment logs
      const logsResponse = await axios.get(
        `${this.apiUrl}/v2/deployments/${latestDeployment.uid}/events`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: this.config.teamId ? { teamId: this.config.teamId } : {}
        }
      );

      return logsResponse.data.map((event: any) => 
        `${event.created}: ${event.text || event.payload?.text || JSON.stringify(event)}`
      );
    } catch (error) {
      console.warn('Could not retrieve logs:', error);
      return [`Error retrieving logs: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  async getStatus(): Promise<{
    status: 'running' | 'stopped' | 'error';
    metadata: Record<string, any>;
  }> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/v9/projects/${this.config.projectName}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: this.config.teamId ? { teamId: this.config.teamId } : {}
        }
      );

      const project = response.data;
      
      // Check latest deployment status
      const deploymentsResponse = await axios.get(
        `${this.apiUrl}/v6/deployments`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            projectId: project.id,
            limit: 1,
            ...(this.config.teamId ? { teamId: this.config.teamId } : {})
          }
        }
      );

      const latestDeployment = deploymentsResponse.data.deployments[0];
      
      let status: 'running' | 'stopped' | 'error' = 'stopped';
      if (latestDeployment) {
        switch (latestDeployment.state) {
          case 'READY':
            status = 'running';
            break;
          case 'ERROR':
          case 'CANCELED':
            status = 'error';
            break;
          default:
            status = 'stopped';
        }
      }

      return {
        status,
        metadata: {
          projectId: project.id,
          projectName: project.name,
          latestDeployment: latestDeployment ? {
            id: latestDeployment.uid,
            state: latestDeployment.state,
            url: latestDeployment.url,
            createdAt: latestDeployment.createdAt
          } : null,
          framework: project.framework,
          nodeVersion: project.nodeVersion
        }
      };
    } catch (error) {
      return {
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}