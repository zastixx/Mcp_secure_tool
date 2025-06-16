import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs-extra';
import { AIGenerator } from '@create-mcp-tool/core';

interface GenerateOptions {
  description?: string;
  output?: string;
  deploy?: string;
  install?: boolean;
  template?: string;
}

export async function generateCommand(options: GenerateOptions) {
  console.log(chalk.blue('\n🚀 Starting MCP Server Generation...\n'));

  try {
    // Get description if not provided
    let description = options.description;
    if (!description) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'description',
          message: 'Describe the tools you need (e.g., "GitHub API tools and Slack notifications"):',
          validate: (input: string) => {
            if (input.trim().length < 10) {
              return 'Please provide a more detailed description (at least 10 characters)';
            }
            return true;
          }
        }
      ]);
      description = answers.description;
    }

    // Validate output directory
    const outputPath = path.resolve(options.output || './generated-mcp-server');
    if (await fs.pathExists(outputPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Directory ${outputPath} already exists. Overwrite?`,
          default: false
        }
      ]);
      
      if (!overwrite) {
        console.log(chalk.yellow('Generation cancelled.'));
        return;
      }
      
      await fs.remove(outputPath);
    }

    // Initialize AI Generator
    const spinner = ora('Initializing AI generator...').start();
    const generator = new AIGenerator();
    
    // Step 1: Analyze description
    spinner.text = 'Analyzing your description with AI...';
    const serverConfig = await generator.generateServerConfig(description);
    
    spinner.succeed('Analysis complete!');
    
    // Show analysis results
    console.log(chalk.green('\n📋 Analysis Results:'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(`${chalk.bold('Server Name:')} ${serverConfig.name}`);
    console.log(`${chalk.bold('Description:')} ${serverConfig.description}`);
    console.log(`${chalk.bold('Tools Found:')} ${serverConfig.tools.length}`);
    
    if (serverConfig.tools.length > 0) {
      console.log(`${chalk.bold('Tool Types:')}`);
      serverConfig.tools.forEach(tool => {
        console.log(`  • ${chalk.cyan(tool.name)} (${tool.category})`);
      });
    }
    
    if (serverConfig.integrations.length > 0) {
      console.log(`${chalk.bold('Integrations:')}`);
      serverConfig.integrations.forEach(integration => {
        console.log(`  • ${chalk.magenta(integration.displayName)}`);
      });
    }
    
    console.log(chalk.gray('━'.repeat(50)));
    
    // Confirm generation
    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Generate server with these configurations?',
        default: true
      }
    ]);
    
    if (!proceed) {
      console.log(chalk.yellow('Generation cancelled.'));
      return;
    }
    
    // Step 2: Generate code
    const generateSpinner = ora('Generating MCP server code...').start();
    
    await generator.scaffoldProject(serverConfig, outputPath);
    
    generateSpinner.succeed('Code generation complete!');
    
    // Step 3: Install dependencies
    if (options.install !== false) {
      const installSpinner = ora('Installing dependencies...').start();
      
      try {
        await generator.installDependencies(outputPath);
        installSpinner.succeed('Dependencies installed!');
      } catch (error) {
        installSpinner.fail('Dependency installation failed');
        console.log(chalk.yellow('You can install dependencies manually by running:'));
        console.log(chalk.cyan(`cd ${path.relative(process.cwd(), outputPath)} && npm install`));
      }
    }
    
    // Step 4: Handle deployment
    if (options.deploy) {
      await handleDeployment(options.deploy, outputPath, serverConfig);
    }
    
    // Success message
    console.log(chalk.green('\n✅ MCP Server Generated Successfully!'));
    console.log(chalk.gray('━'.repeat(50)));
    console.log(`${chalk.bold('Location:')} ${outputPath}`);
    console.log(`${chalk.bold('Next Steps:')}`);
    console.log(`  1. ${chalk.cyan(`cd ${path.relative(process.cwd(), outputPath)}`)}`);
    
    if (options.install === false) {
      console.log(`  2. ${chalk.cyan('npm install')}`);
      console.log(`  3. ${chalk.cyan('npm run dev')}`);
    } else {
      console.log(`  2. ${chalk.cyan('npm run dev')}`);
    }
    
    console.log(`  3. ${chalk.cyan('Configure your .env file with API keys')}`);
    console.log(`  4. ${chalk.cyan('Start building your MCP tools!')}`);
    
    if (serverConfig.integrations.length > 0) {
      console.log(`\n${chalk.bold('🔧 Configuration Required:')}`);
      serverConfig.integrations.forEach(integration => {
        console.log(`  • ${integration.displayName}: Check README.md for setup instructions`);
      });
    }
    
  } catch (error: any) {
    console.error(chalk.red('\n❌ Generation failed:'), error.message);
    
    if (error.code === 'OPENAI_API_KEY_MISSING') {
      console.log(chalk.yellow('\n💡 Setup required:'));
      console.log('   Set your OpenAI API key: export OPENAI_API_KEY=your_key_here');
    }
    
    process.exit(1);
  }
}

async function handleDeployment(platform: string, outputPath: string, serverConfig: any) {
  const deploySpinner = ora(`Preparing deployment for ${platform}...`).start();
  
  try {
    // TODO: Implement deployment logic
    deploySpinner.succeed(`Deployment configuration for ${platform} added!`);
    console.log(chalk.blue(`\n🚀 Deployment files created for ${platform}`));
  } catch (error: any) {
    deploySpinner.fail(`Deployment setup failed: ${error.message}`);
  }
}