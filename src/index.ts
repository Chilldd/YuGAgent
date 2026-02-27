#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
  .name('yugagent')
  .description('现代化多模型终端 AI 助手')
  .version('2.0.0');

program.parse();
