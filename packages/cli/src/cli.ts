#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { devCommand } from './commands/dev';

const packageJson = require('../package.json');

// ASCII Art Banner
const banner = `
${chalk.cyan('╔════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.blue('🤖 Create MCP Tool')}                  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('AI-Powered MCP Server Generator')}     ${chalk.cyan('║')}
${chalk.cyan('╚════════════════════════════════════════╝')}
`;

console.log(banner);

program
  .name('create-mcp-tool')
  .description('AI-powered MCP server generator')
  .version(packageJson.version);

// Main generation command
program
  .command('generate')
  .alias('g')
  .description('Generate MCP server from description')
  .option('-d, --description <description>', 'Natural language description of tools needed')
  .option('-o, --output <path>', 'Output directory', './generated-mcp-server')
  .option('--deploy <platform>', 'Deploy to platform (aws-lambda, vercel, docker)')
  .option('--no-install', 'Skip npm install')
  .option('--template <template>', 'Use specific template (typescript, javascript, python)')
  .action(generateCommand);

// AI shorthand command
program
  .command('ai <description>')
  .description('Quick AI generation (alias for generate)')
  .option('-o, --output <path>', 'Output directory', './generated-mcp-server')
  .option('--deploy <platform>', 'Deploy to platform')
  .action((description, options) => {
    generateCommand({ ...options, description });
  });

// Template initialization
program
  .command('init')
  .alias('i')
  .description('Initialize from template')
  .option('-t, --template <template>', 'Template name (api-tools, file-manager, database)')
  .option('-o, --output <path>', 'Output directory', './mcp-server')
  .action(initCommand);

// Development mode
program
  .command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'Port number', '3000')
  .option('-w, --watch', 'Watch for changes')
  .action(devCommand);

// Global error handler
program.exitOverride();

try {
  program.parse();
} catch (err: any) {
  if (err.code === 'commander.helpDisplayed') {
    process.exit(0);
  }
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
}

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}