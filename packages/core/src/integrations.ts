import { IntegrationConfig } from './types';

/**
 * Library of pre-configured integrations for popular services
 */
export const INTEGRATIONS: IntegrationConfig[] = [
  // GitHub API
  {
    id: 'github',
    name: 'github-api',
    displayName: 'GitHub API',
    description: 'Integrate with GitHub repositories, issues, and pull requests',
    dependencies: ['@octokit/rest', '@octokit/auth-app'],
    authType: 'api-key',
    environmentVariables: ['GITHUB_TOKEN', 'GITHUB_APP_ID', 'GITHUB_PRIVATE_KEY'],
    configSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'GitHub personal access token' },
        owner: { type: 'string', description: 'Repository owner' },
        repo: { type: 'string', description: 'Repository name' }
      },
      required: ['token']
    },
    setupInstructions: `
# GitHub Integration Setup

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate a new token with appropriate scopes (repo, issues, etc.)

2. Set environment variables:
   \`\`\`bash
   export GITHUB_TOKEN=your_token_here
   \`\`\`

3. Usage examples:
   - List issues: \`github.issues.list()\`
   - Create issue: \`github.issues.create({ title, body })\`
   - Get repository info: \`github.repos.get({ owner, repo })\`
`
  },

  // Slack API
  {
    id: 'slack',
    name: 'slack-api',
    displayName: 'Slack API',
    description: 'Send messages and interact with Slack workspaces',
    dependencies: ['@slack/web-api', '@slack/bolt'],
    authType: 'api-key',
    environmentVariables: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'],
    configSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Slack bot token' },
        channel: { type: 'string', description: 'Default channel' }
      },
      required: ['token']
    },
    setupInstructions: `
# Slack Integration Setup

1. Create a Slack App:
   - Go to https://api.slack.com/apps
   - Create a new app and install it to your workspace

2. Get your bot token:
   - In your app settings, go to OAuth & Permissions
   - Copy the "Bot User OAuth Token"

3. Set environment variables:
   \`\`\`bash
   export SLACK_BOT_TOKEN=xoxb-your-token-here
   \`\`\`

4. Usage examples:
   - Send message: \`slack.chat.postMessage({ channel, text })\`
   - Upload file: \`slack.files.upload({ channels, file })\`
`
  },

  // PostgreSQL Database
  {
    id: 'postgresql',
    name: 'postgresql-db',
    displayName: 'PostgreSQL Database',
    description: 'Connect to and query PostgreSQL databases',
    dependencies: ['pg', '@types/pg'],
    authType: 'basic',
    environmentVariables: ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Database host' },
        port: { type: 'number', description: 'Database port', default: 5432 },
        database: { type: 'string', description: 'Database name' },
        user: { type: 'string', description: 'Database user' },
        password: { type: 'string', description: 'Database password' },
        ssl: { type: 'boolean', description: 'Use SSL connection', default: false }
      },
      required: ['host', 'database', 'user', 'password']
    },
    setupInstructions: `
# PostgreSQL Integration Setup

1. Set up your PostgreSQL database connection:
   \`\`\`bash
   export DATABASE_URL=postgresql://user:password@localhost:5432/dbname
   # OR set individual variables:
   export DB_HOST=localhost
   export DB_PORT=5432
   export DB_NAME=your_database
   export DB_USER=your_username
   export DB_PASSWORD=your_password
   \`\`\`

2. Usage examples:
   - Query: \`db.query('SELECT * FROM users WHERE id = $1', [userId])\`
   - Insert: \`db.query('INSERT INTO users (name, email) VALUES ($1, $2)', [name, email])\`
`
  },

  // SendGrid Email
  {
    id: 'sendgrid',
    name: 'sendgrid-email',
    displayName: 'SendGrid Email',
    description: 'Send emails using SendGrid service',
    dependencies: ['@sendgrid/mail'],
    authType: 'api-key',
    environmentVariables: ['SENDGRID_API_KEY'],
    configSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'SendGrid API key' },
        fromEmail: { type: 'string', description: 'Default sender email' },
        fromName: { type: 'string', description: 'Default sender name' }
      },
      required: ['apiKey', 'fromEmail']
    },
    setupInstructions: `
# SendGrid Integration Setup

1. Get your SendGrid API key:
   - Sign up at https://sendgrid.com
   - Go to Settings > API Keys
   - Create a new API key with Mail Send permissions

2. Set environment variables:
   \`\`\`bash
   export SENDGRID_API_KEY=your_api_key_here
   \`\`\`

3. Usage examples:
   - Send email: \`sendgrid.send({ to, from, subject, text, html })\`
   - Send template: \`sendgrid.send({ to, from, templateId, dynamicTemplateData })\`
`
  },

  // AWS S3
  {
    id: 'aws-s3',
    name: 'aws-s3-storage',
    displayName: 'AWS S3 Storage',
    description: 'Upload, download, and manage files in AWS S3',
    dependencies: ['@aws-sdk/client-s3', '@aws-sdk/s3-request-presigner'],
    authType: 'api-key',
    environmentVariables: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'],
    configSchema: {
      type: 'object',
      properties: {
        accessKeyId: { type: 'string', description: 'AWS access key ID' },
        secretAccessKey: { type: 'string', description: 'AWS secret access key' },
        region: { type: 'string', description: 'AWS region', default: 'us-east-1' },
        bucket: { type: 'string', description: 'S3 bucket name' }
      },
      required: ['accessKeyId', 'secretAccessKey', 'bucket']
    },
    setupInstructions: `
# AWS S3 Integration Setup

1. Set up AWS credentials:
   - Create an IAM user in AWS Console
   - Generate access keys with S3 permissions

2. Set environment variables:
   \`\`\`bash
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1
   export AWS_S3_BUCKET=your-bucket-name
   \`\`\`

3. Usage examples:
   - Upload file: \`s3.upload({ key, body, contentType })\`
   - Download file: \`s3.download({ key })\`
   - Delete file: \`s3.delete({ key })\`
`
  },

  // Discord Bot
  {
    id: 'discord',
    name: 'discord-bot',
    displayName: 'Discord Bot',
    description: 'Create Discord bot interactions and send messages',
    dependencies: ['discord.js'],
    authType: 'api-key',
    environmentVariables: ['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID'],
    configSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Discord bot token' },
        clientId: { type: 'string', description: 'Discord application client ID' },
        guildId: { type: 'string', description: 'Discord server ID' }
      },
      required: ['token', 'clientId']
    },
    setupInstructions: `
# Discord Bot Integration Setup

1. Create a Discord Application:
   - Go to https://discord.com/developers/applications
   - Create a new application and add a bot

2. Get your bot token:
   - In Bot settings, copy the token

3. Set environment variables:
   \`\`\`bash
   export DISCORD_BOT_TOKEN=your_bot_token
   export DISCORD_CLIENT_ID=your_client_id
   \`\`\`

4. Usage examples:
   - Send message: \`discord.channels.get(channelId).send(message)\`
   - Create slash command: \`discord.commands.create({ name, description })\`
`
  },

  // Twilio SMS
  {
    id: 'twilio',
    name: 'twilio-sms',
    displayName: 'Twilio SMS',
    description: 'Send SMS messages using Twilio',
    dependencies: ['twilio'],
    authType: 'basic',
    environmentVariables: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    configSchema: {
      type: 'object',
      properties: {
        accountSid: { type: 'string', description: 'Twilio Account SID' },
        authToken: { type: 'string', description: 'Twilio Auth Token' },
        phoneNumber: { type: 'string', description: 'Twilio phone number' }
      },
      required: ['accountSid', 'authToken', 'phoneNumber']
    },
    setupInstructions: `
# Twilio SMS Integration Setup

1. Set up Twilio account:
   - Sign up at https://www.twilio.com
   - Get a phone number and note your Account SID and Auth Token

2. Set environment variables:
   \`\`\`bash
   export TWILIO_ACCOUNT_SID=your_account_sid
   export TWILIO_AUTH_TOKEN=your_auth_token
   export TWILIO_PHONE_NUMBER=your_twilio_number
   \`\`\`

3. Usage examples:
   - Send SMS: \`twilio.messages.create({ to, from, body })\`
   - Send MMS: \`twilio.messages.create({ to, from, body, mediaUrl })\`
`
  },

  // OpenAI API
  {
    id: 'openai',
    name: 'openai-api',
    displayName: 'OpenAI API',
    description: 'Integrate with OpenAI GPT models and other AI services',
    dependencies: ['openai'],
    authType: 'api-key',
    environmentVariables: ['OPENAI_API_KEY'],
    configSchema: {
      type: 'object',
      properties: {
        apiKey: { type: 'string', description: 'OpenAI API key' },
        model: { type: 'string', description: 'Default model', default: 'gpt-3.5-turbo' },
        organization: { type: 'string', description: 'OpenAI organization ID' }
      },
      required: ['apiKey']
    },
    setupInstructions: `
# OpenAI API Integration Setup

1. Get your OpenAI API key:
   - Sign up at https://platform.openai.com
   - Go to API Keys and create a new key

2. Set environment variables:
   \`\`\`bash
   export OPENAI_API_KEY=your_api_key_here
   \`\`\`

3. Usage examples:
   - Chat completion: \`openai.chat.completions.create({ model, messages })\`
   - Image generation: \`openai.images.generate({ prompt, size })\`
`
  }
];

/**
 * Find integrations that match given service names or keywords
 */
export function findMatchingIntegrations(keywords: string[]): IntegrationConfig[] {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  return INTEGRATIONS.filter(integration => {
    return lowerKeywords.some(keyword => 
      integration.id.toLowerCase().includes(keyword) ||
      integration.name.toLowerCase().includes(keyword) ||
      integration.displayName.toLowerCase().includes(keyword) ||
      integration.description.toLowerCase().includes(keyword)
    );
  });
}

/**
 * Get integration by ID
 */
export function getIntegrationById(id: string): IntegrationConfig | undefined {
  return INTEGRATIONS.find(integration => integration.id === id);
}

/**
 * Get all available integrations
 */
export function getAllIntegrations(): IntegrationConfig[] {
  return INTEGRATIONS;
}

/**
 * Get integrations by auth type
 */
export function getIntegrationsByAuthType(authType: string): IntegrationConfig[] {
  return INTEGRATIONS.filter(integration => integration.authType === authType);
}