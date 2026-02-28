/**
 * @fileoverview Logger - 日志系统，支持可控制的日志级别
 * @module infrastructure/logging/logger
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * 日志级别名称映射
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
};

/**
 * 日志级别颜色映射（用于终端输出）
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: '\x1b[36m', // cyan
  [LogLevel.INFO]: '\x1b[32m',  // green
  [LogLevel.WARN]: '\x1b[33m',  // yellow
  [LogLevel.ERROR]: '\x1b[31m', // red
  [LogLevel.SILENT]: '\x1b[0m', // reset
};

const RESET_COLOR = '\x1b[0m';

/**
 * Logger 类 - 支持分级别日志输出
 */
export class Logger {
  private level: LogLevel;
  private prefix: string;

  /**
   * 创建 Logger 实例
   *
   * @param prefix - 日志前缀，通常为模块名
   * @param level - 可选的日志级别，默认从环境变量读取
   */
  constructor(prefix: string, level?: LogLevel) {
    this.prefix = prefix;
    this.level = level !== undefined ? level : Logger.getGlobalLevel();
  }

  /**
   * 从环境变量获取全局日志级别
   *
   * 环境变量（优先级从高到低）：
   * - YUGAGENT_LOG_LEVEL: silent | error | warn | info | debug
   * - DEBUG: 任何非空值表示 debug 级别
   *
   * @returns 日志级别
   */
  static getGlobalLevel(): LogLevel {
    // step1. 检查 YUGAGENT_LOG_LEVEL 环境变量
    const logLevelEnv = process.env.YUGAGENT_LOG_LEVEL?.toLowerCase();
    if (logLevelEnv) {
      switch (logLevelEnv) {
        case 'silent':
          return LogLevel.SILENT;
        case 'error':
          return LogLevel.ERROR;
        case 'warn':
          return LogLevel.WARN;
        case 'info':
          return LogLevel.INFO;
        case 'debug':
          return LogLevel.DEBUG;
        default:
          // 默认 info 级别
          return LogLevel.INFO;
      }
    }

    // step2. 检查 DEBUG 环境变量（兼容常见的 debug 模式）
    if (process.env.DEBUG) {
      return LogLevel.DEBUG;
    }

    // step3. 默认 info 级别
    return LogLevel.INFO;
  }

  /**
   * 设置当前 logger 的日志级别
   *
   * @param level - 日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 获取当前 logger 的日志级别
   *
   * @returns 日志级别
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 判断是否应该输出某级别的日志
   *
   * @param level - 日志级别
   * @returns 是否应该输出
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * 格式化日志消息
   *
   * @param level - 日志级别
   * @param message - 日志消息
   * @returns 格式化后的字符串
   */
  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const levelName = LOG_LEVEL_NAMES[level];
    const color = LOG_LEVEL_COLORS[level];
    return `${color}[${timestamp}] [${levelName}] [${this.prefix}]${RESET_COLOR} ${message}`;
  }

  /**
   * 输出 debug 级别日志
   *
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  debug(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.format(LogLevel.DEBUG, message);
      // eslint-disable-next-line no-console
      console.log(formatted, data !== undefined ? this.sanitizeData(data) : '');
    }
  }

  /**
   * 输出 info 级别日志
   *
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  info(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.format(LogLevel.INFO, message);
      // eslint-disable-next-line no-console
      console.log(formatted, data !== undefined ? this.sanitizeData(data) : '');
    }
  }

  /**
   * 输出 warn 级别日志
   *
   * @param message - 日志消息
   * @param data - 可选的附加数据
   */
  warn(message: string, data?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.format(LogLevel.WARN, message);
      // eslint-disable-next-line no-console
      console.warn(formatted, data !== undefined ? this.sanitizeData(data) : '');
    }
  }

  /**
   * 输出 error 级别日志
   *
   * @param message - 日志消息
   * @param error - 可选的错误对象
   */
  error(message: string, error?: Error | unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.format(LogLevel.ERROR, message);
      // eslint-disable-next-line no-console
      console.error(formatted, error !== undefined ? this.sanitizeData(error) : '');
    }
  }

  /**
   * 清理敏感数据
   *
   * @param data - 需要清理的数据
   * @returns 清理后的数据
   */
  private sanitizeData(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'string') {
      // 限制字符串长度
      return data.length > 1000 ? data.slice(0, 1000) + '...(truncated)' : data;
    }

    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack?.split('\n').slice(0, 5).join('\n'), // 只保留前5行堆栈
      };
    }

    if (typeof data === 'object') {
      try {
        const str = JSON.stringify(data);
        if (str.length > 2000) {
          return '(large object truncated)';
        }
        return data;
      } catch {
        return '(circular or unserializable object)';
      }
    }

    return data;
  }
}

/**
 * 创建模块特定的 logger 实例
 *
 * @param moduleName - 模块名称
 * @returns Logger 实例
 */
export function createLogger(moduleName: string): Logger {
  return new Logger(moduleName);
}
