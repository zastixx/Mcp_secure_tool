// Main CLI exports for programmatic usage
export { generateCommand } from './commands/generate';
export { initCommand } from './commands/init';
export { devCommand } from './commands/dev';

// Types
export interface GenerateOptions {
  description?: string;
  output?: string;
  deploy?: string;
  install?: boolean;
  template?: string;
}

export interface InitOptions {
  template?: string;
  output?: string;
}

export interface DevOptions {
  port?: string;
  watch?: boolean;
}