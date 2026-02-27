#!/usr/bin/env node

/**
 * @fileoverview YuGAgent CLI entry point
 * @module index
 */

import { Command } from 'commander';
import { createApp, shutdownApp } from './di/container.js';
import { startTUI } from './ui/ink/index.js';

/**
 * YuGAgent CLI Program
 */
const program = new Command();

program
  .name('yugagent')
  .description('现代化多模型终端 AI 助手')
  .version('2.0.0');

/**
 * Chat command - Start interactive TUI chat
 */
program
  .command('chat')
  .description('启动交互式聊天界面')
  .action(async () => {
    try {
      // Create application container
      const { aiService } = createApp();

      // Start TUI with AI service
      startTUI(aiService, 'YuGAgent', '2.0.0');
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to start chat: ${error.message}`);
        if (error.message.includes('ZHIPU_API_KEY')) {
          console.error('\nPlease set the ZHIPU_API_KEY environment variable:');
          console.error('  export ZHIPU_API_KEY=your_api_key_here');
          console.error('  set ZHIPU_API_KEY=your_api_key_here  # Windows');
        }
      } else {
        console.error('Failed to start chat: Unknown error');
      }
      process.exit(1);
    }
  });

/**
 * Ask command - Send a single question and get response
 */
program
  .command('ask <question>')
  .description('直接提问并获取回复')
  .option('-m, --model <model>', '指定模型名称', 'glm-4.7')
  .option('-t, --temperature <temp>', '设置温度 (0-1)', parseFloat, 0.7)
  .option('--json', '以 JSON 格式输出')
  .action(async (question: string, options: { model: string; temperature: number; json: boolean }) => {
    try {
      // Create application container with custom config
      const { chatController } = createApp({
        agentConfig: {
          model: options.model,
          temperature: options.temperature,
        },
      });

      // Send message
      const response = await chatController.sendMessage({
        message: question,
      });

      // Output response
      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
      } else {
        // Print the response text
        console.log(response.response);

        // Print tool call info if any
        if (response.toolCalls && response.toolCalls.length > 0) {
          console.log('\n[Tool Calls]');
          for (const toolCall of response.toolCalls) {
            console.log(`  - ${toolCall.name}`);
          }
        }

        // Print token usage
        console.log(`\n[Tokens] ${response.tokenUsage.totalTokens} total (${response.tokenUsage.promptTokens} prompt + ${response.tokenUsage.completionTokens} completion)`);

        // Print error if any
        if (response.error) {
          console.error(`\nError: ${response.error}`);
        }
      }

      // Shutdown
      shutdownApp({ chatController } as any);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        if (error.message.includes('ZHIPU_API_KEY')) {
          console.error('\nPlease set the ZHIPU_API_KEY environment variable:');
          console.error('  export ZHIPU_API_KEY=your_api_key_here');
          console.error('  set ZHIPU_API_KEY=your_api_key_here  # Windows');
        }
      } else {
        console.error('Error: Unknown error');
      }
      process.exit(1);
    }
  });

/**
 * Status command - Show current configuration and status
 */
program
  .command('status')
  .description('显示当前配置和状态')
  .action(() => {
    try {
      const { modelProvider, aiService } = createApp();

      const config = modelProvider.getConfig();
      const status = aiService.getStatus();

      console.log('YuGAgent Status:');
      console.log(`  Version: 2.0.0`);
      console.log(`  Provider: Zhipu AI`);
      console.log(`  Model: ${config.model}`);
      console.log(`  Base URL: ${config.baseURL}`);
      console.log(`  Status: ${status.status}`);
      console.log(`  Session ID: ${status.sessionId || 'N/A'}`);

      shutdownApp({ modelProvider, aiService } as any);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      } else {
        console.error('Error: Unknown error');
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
