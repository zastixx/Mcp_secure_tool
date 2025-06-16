// packages/deploy/src/aws-lambda.ts
import { writeFile, mkdir, copyFile } from 'fs-extra';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as AWS from 'aws-sdk';
import { DeploymentAdapter, DeploymentConfig, DeploymentResult } from './types';

const execAsync = promisify(exec);

export interface LambdaConfig extends DeploymentConfig {
  functionName: string;
  runtime: 'nodejs18.x' | 'nodejs20.x';
  handler: string;
  role: string;
  region: string;
  timeout?: number;
  memorySize?: number;
  environment?: Record<string, string>;
  vpc?: {
    subnetIds: string[];
    securityGroupIds: string[];
  };
}

export class AWSLambdaAdapter implements DeploymentAdapter {
  private lambda: AWS.Lambda;

  constructor(private config: LambdaConfig) {
    AWS.config.update({ region: config.region });
    this.lambda = new AWS.Lambda();
  }

  async deploy(projectPath: string): Promise<DeploymentResult> {
    try {
      console.log('🚀 Preparing AWS Lambda deployment...');
      
      // 1. Create Lambda-specific files
      await this.createLambdaFiles(projectPath);
      
      // 2. Build the project
      await this.buildProject(projectPath);
      
      // 3. Package for Lambda
      const zipPath = await this.packageForLambda(projectPath);
      
      // 4. Deploy to AWS Lambda
      const deploymentInfo = await this.deployToLambda(zipPath);
      
      return {
        success: true,
        url: deploymentInfo.functionUrl,
        logs: deploymentInfo.logs,
        metadata: {
          functionName: this.config.functionName,
          functionArn: deploymentInfo.functionArn,
          region: this.config.region
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

  private async createLambdaFiles(projectPath: string): Promise<void> {
    // Create Lambda handler
    const handlerContent = `
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { MCPServer } from './src/index';

let server: MCPServer | null = null;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Initialize server if not already done
    if (!server) {
      server = new MCPServer();
      await server.initialize();
    }

    // Handle MCP requests
    const body = JSON.parse(event.body || '{}');
    const result = await server.handleRequest(body);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
`;

    await writeFile(join(projectPath, 'lambda-handler.ts'), handlerContent);

    // Create deployment configuration
    const deployConfig = `
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
`;

    await writeFile(join(projectPath, 'lambda-trust-policy.json'), deployConfig);

    // Create CloudFormation template
    const cfTemplate = {
      AWSTemplateFormatVersion: '2010-09-09',
      Description: 'MCP Server Lambda Deployment',
      Resources: {
        MCPServerRole: {
          Type: 'AWS::IAM::Role',
          Properties: {
            AssumeRolePolicyDocument: JSON.parse(deployConfig),
            ManagedPolicyArns: [
              'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            ]
          }
        },
        MCPServerFunction: {
          Type: 'AWS::Lambda::Function',
          Properties: {
            FunctionName: this.config.functionName,
            Runtime: this.config.runtime,
            Handler: this.config.handler,
            Role: { 'Fn::GetAtt': ['MCPServerRole', 'Arn'] },
            Code: {
              ZipFile: 'placeholder'
            },
            Timeout: this.config.timeout || 30,
            MemorySize: this.config.memorySize || 256,
            Environment: {
              Variables: this.config.environment || {}
            }
          }
        },
        MCPServerFunctionUrl: {
          Type: 'AWS::Lambda::Url',
          Properties: {
            TargetFunctionArn: { Ref: 'MCPServerFunction' },
            AuthType: 'NONE',
            Cors: {
              AllowCredentials: false,
              AllowHeaders: ['Content-Type', 'Authorization'],
              AllowMethods: ['GET', 'POST', 'OPTIONS'],
              AllowOrigins: ['*']
            }
          }
        }
      },
      Outputs: {
        FunctionUrl: {
          Description: 'Lambda Function URL',
          Value: { 'Fn::GetAtt': ['MCPServerFunctionUrl', 'FunctionUrl'] }
        },
        FunctionArn: {
          Description: 'Lambda Function ARN',
          Value: { Ref: 'MCPServerFunction' }
        }
      }
    };

    await writeFile(
      join(projectPath, 'cloudformation-template.json'),
      JSON.stringify(cfTemplate, null, 2)
    );
  }

  private async buildProject(projectPath: string): Promise<void> {
    console.log('📦 Building project for Lambda...');
    
    // Install dependencies
    await execAsync('npm install', { cwd: projectPath });
    
    // Build TypeScript
    await execAsync('npm run build', { cwd: projectPath });
  }

  private async packageForLambda(projectPath: string): Promise<string> {
    console.log('📦 Packaging for Lambda deployment...');
    
    const zipPath = join(projectPath, 'lambda-deployment.zip');
    
    // Create zip with all necessary files
    await execAsync(
      `zip -r lambda-deployment.zip dist/ node_modules/ package.json`,
      { cwd: projectPath }
    );
    
    return zipPath;
  }

  private async deployToLambda(zipPath: string): Promise<{
    functionArn: string;
    functionUrl?: string;
    logs: string[];
  }> {
    const logs: string[] = [];
    
    try {
      // Check if function exists
      let functionExists = false;
      try {
        await this.lambda.getFunction({ FunctionName: this.config.functionName }).promise();
        functionExists = true;
        logs.push(`Function ${this.config.functionName} already exists, updating...`);
      } catch (error) {
        logs.push(`Creating new function ${this.config.functionName}...`);
      }

      const zipBuffer = require('fs').readFileSync(zipPath);

      let result;
      if (functionExists) {
        // Update existing function
        result = await this.lambda.updateFunctionCode({
          FunctionName: this.config.functionName,
          ZipFile: zipBuffer
        }).promise();
        
        // Update configuration if needed
        await this.lambda.updateFunctionConfiguration({
          FunctionName: this.config.functionName,
          Runtime: this.config.runtime,
          Handler: this.config.handler,
          Timeout: this.config.timeout || 30,
          MemorySize: this.config.memorySize || 256,
          Environment: {
            Variables: this.config.environment || {}
          }
        }).promise();
      } else {
        // Create new function
        result = await this.lambda.createFunction({
          FunctionName: this.config.functionName,
          Runtime: this.config.runtime,
          Role: this.config.role,
          Handler: this.config.handler,
          Code: { ZipFile: zipBuffer },
          Timeout: this.config.timeout || 30,
          MemorySize: this.config.memorySize || 256,
          Environment: {
            Variables: this.config.environment || {}
          },
          VpcConfig: this.config.vpc
        }).promise();
      }

      logs.push(`Function deployed successfully: ${result.FunctionArn}`);

      // Create or update function URL
      let functionUrl: string | undefined;
      try {
        const urlConfig = await this.lambda.createFunctionUrlConfig({
          FunctionName: this.config.functionName,
          AuthType: 'NONE',
          Cors: {
            AllowCredentials: false,
            AllowHeaders: ['Content-Type', 'Authorization'],
            AllowMethods: ['GET', 'POST', 'OPTIONS'],
            AllowOrigins: ['*']
          }
        }).promise();
        
        functionUrl = urlConfig.FunctionUrl;
        logs.push(`Function URL created: ${functionUrl}`);
      } catch (error) {
        // Function URL might already exist
        try {
          const urlConfig = await this.lambda.getFunctionUrlConfig({
            FunctionName: this.config.functionName
          }).promise();
          functionUrl = urlConfig.FunctionUrl;
          logs.push(`Using existing function URL: ${functionUrl}`);
        } catch (e) {
          logs.push('Warning: Could not create or retrieve function URL');
        }
      }

      return {
        functionArn: result.FunctionArn!,
        functionUrl,
        logs
      };
    } catch (error) {
      logs.push(`Deployment error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  async undeploy(): Promise<DeploymentResult> {
    try {
      console.log(`🗑️  Removing Lambda function ${this.config.functionName}...`);
      
      // Delete function URL first
      try {
        await this.lambda.deleteFunctionUrlConfig({
          FunctionName: this.config.functionName
        }).promise();
      } catch (error) {
        // Ignore if function URL doesn't exist
      }

      // Delete the function
      await this.lambda.deleteFunction({
        FunctionName: this.config.functionName
      }).promise();

      return {
        success: true,
        logs: [`Function ${this.config.functionName} deleted successfully`]
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
      const cloudWatchLogs = new AWS.CloudWatchLogs({ region: this.config.region });
      
      const logGroupName = `/aws/lambda/${this.config.functionName}`;
      
      const result = await cloudWatchLogs.filterLogEvents({
        logGroupName,
        limit: 100,
        startTime: Date.now() - (24 * 60 * 60 * 1000) // Last 24 hours
      }).promise();

      return result.events?.map(event => event.message || '') || [];
    } catch (error) {
      console.warn('Could not retrieve logs:', error);
      return [];
    }
  }

  async getStatus(): Promise<{
    status: 'running' | 'stopped' | 'error';
    metadata: Record<string, any>;
  }> {
    try {
      const result = await this.lambda.getFunction({
        FunctionName: this.config.functionName
      }).promise();

      return {
        status: result.Configuration?.State === 'Active' ? 'running' : 'error',
        metadata: {
          state: result.Configuration?.State,
          lastModified: result.Configuration?.LastModified,
          runtime: result.Configuration?.Runtime,
          memorySize: result.Configuration?.MemorySize,
          timeout: result.Configuration?.Timeout
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