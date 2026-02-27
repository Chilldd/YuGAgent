/**
 * @fileoverview Chat Controller - Interface for handling chat operations
 * @module application/interfaces/controllers/chat.controller
 */

import { v4 as uuidv4 } from 'uuid';

import type { AIService } from '../../services/ai-service.js';
import type {
  SendMessageDto,
  SendMessageResponseDto,
  ClearHistoryDto,
  ClearHistoryResponseDto,
  ServiceStatusInfo,
} from '../../dto/chat.dto.js';

/**
 * Controller event types
 */
export enum ControllerEventType {
  /** Before a message is sent */
  BEFORE_MESSAGE = 'controller:beforeMessage',
  /** After a message is processed */
  AFTER_MESSAGE = 'controller:afterMessage',
  /** When a message encounters an error */
  MESSAGE_ERROR = 'controller:messageError',
  /** When history is cleared */
  HISTORY_CLEARED = 'controller:historyCleared',
  /** When clearing history encounters an error */
  CLEAR_HISTORY_ERROR = 'controller:clearHistoryError',
  /** When a hook event is forwarded */
  HOOK_EVENT = 'controller:hookEvent',
  /** When service is initialized */
  INITIALIZED = 'controller:initialized',
  /** When service is shut down */
  SHUTDOWN = 'controller:shutdown',
}

/**
 * Event listener data for controller events
 */
export interface ControllerEventData {
  /** Event type */
  type: ControllerEventType;
  /** Timestamp when the event occurred */
  timestamp: Date;
  /** Associated session ID if available */
  sessionId?: string;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Controller event listener function type
 */
export type ControllerEventListener = (data: ControllerEventData) => void | Promise<void>;

/**
 * Chat Controller - Manages chat operations between UI and AI Service
 *
 * The controller serves as the interface layer between the presentation layer (UI)
 * and the application layer (AI Service). It provides:
 * - Methods for all chat operations
 * - Event handling for UI updates
 * - Request/response transformation
 */
export class ChatController {
  private readonly service: AIService;
  private readonly controllerId: string;
  private readonly eventListeners: Map<string, Set<ControllerEventListener>>;

  /**
   * Create a new ChatController
   *
   * @param service - The AI service instance
   */
  constructor(service: AIService) {
    this.service = service;
    this.controllerId = uuidv4();
    this.eventListeners = new Map();

    // Setup service event forwarding
    this.setupServiceEventForwarding();
  }

  /**
   * Send a message to the AI agent
   *
   * @param dto - The send message DTO
   * @returns Promise resolving to the agent's response
   */
  async sendMessage(dto: SendMessageDto): Promise<SendMessageResponseDto> {
    return this.service.sendMessage(dto);
  }

  /**
   * Clear the conversation history
   *
   * @param dto - The clear history DTO
   * @returns Promise resolving to the clear history response
   */
  async clearHistory(dto?: ClearHistoryDto): Promise<ClearHistoryResponseDto> {
    return this.service.clearHistory(dto);
  }

  /**
   * Get the current service status
   *
   * @returns The current service status information
   */
  getStatus(): ServiceStatusInfo {
    return this.service.getStatus();
  }

  /**
   * Get the current session ID
   *
   * @returns The current session ID or null
   */
  getSessionId(): string | null {
    return this.service.getSessionId();
  }

  /**
   * Check if the service is ready
   *
   * @returns True if service is ready to process requests
   */
  isReady(): boolean {
    return this.service.isReady();
  }

  /**
   * Check if the service is processing
   *
   * @returns True if service is currently processing
   */
  isProcessing(): boolean {
    return this.service.isProcessing();
  }

  /**
   * Register an event listener
   *
   * @param event - The event type to listen for
   * @param listener - The event listener function
   */
  on(event: ControllerEventType, listener: ControllerEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Register a one-time event listener
   *
   * @param event - The event type to listen for
   * @param listener - The event listener function
   */
  once(event: ControllerEventType, listener: ControllerEventListener): void {
    const wrappedListener: ControllerEventListener = async (data) => {
      await listener(data);
      this.off(event, wrappedListener);
    };
    this.on(event, wrappedListener);
  }

  /**
   * Remove an event listener
   *
   * @param event - The event type
   * @param listener - The event listener function to remove
   */
  off(event: ControllerEventType, listener: ControllerEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Remove all event listeners for an event
   *
   * @param event - The event type to clear listeners for
   */
  offAll(event: ControllerEventType): void {
    this.eventListeners.delete(event);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * Get the controller ID
   *
   * @returns The unique controller ID
   */
  getControllerId(): string {
    return this.controllerId;
  }

  /**
   * Get the AI service instance
   *
   * @returns The AI service
   */
  getService(): AIService {
    return this.service;
  }

  /**
   * Shutdown the controller and cleanup resources
   */
  shutdown(): void {
    // Emit shutdown event
    this.emit(ControllerEventType.SHUTDOWN, {
      timestamp: new Date(),
      data: {
        controllerId: this.controllerId,
      },
    });

    // Remove all event listeners
    this.removeAllListeners();

    // Shutdown the service
    this.service.shutdown();
  }

  /**
   * Setup event forwarding from the AI service
   */
  private setupServiceEventForwarding(): void {
    // Forward 'initialized' event
    this.service.on('initialized', (data: any) => {
      this.emit(ControllerEventType.INITIALIZED, {
        timestamp: new Date(),
        sessionId: data.sessionId,
        data,
      });
    });

    // Forward 'beforeMessage' event
    this.service.on('beforeMessage', (data: any) => {
      this.emit(ControllerEventType.BEFORE_MESSAGE, {
        timestamp: new Date(),
        sessionId: data.sessionId,
        data,
      });
    });

    // Forward 'afterMessage' event
    this.service.on('afterMessage', (data: any) => {
      this.emit(ControllerEventType.AFTER_MESSAGE, {
        timestamp: new Date(),
        sessionId: data.response?.sessionId,
        data,
      });
    });

    // Forward 'messageError' event
    this.service.on('messageError', (data: any) => {
      this.emit(ControllerEventType.MESSAGE_ERROR, {
        timestamp: new Date(),
        data,
      });
    });

    // Forward 'historyCleared' event
    this.service.on('historyCleared', (data: any) => {
      this.emit(ControllerEventType.HISTORY_CLEARED, {
        timestamp: new Date(),
        sessionId: data.sessionId,
        data,
      });
    });

    // Forward 'clearHistoryError' event
    this.service.on('clearHistoryError', (data: any) => {
      this.emit(ControllerEventType.CLEAR_HISTORY_ERROR, {
        timestamp: new Date(),
        sessionId: data.sessionId,
        data,
      });
    });

    // Forward 'hook' events
    this.service.on('hook', (data: any) => {
      this.emit(ControllerEventType.HOOK_EVENT, {
        timestamp: new Date(),
        data,
      });
    });

    // Forward 'shutdown' event
    this.service.on('shutdown', (data: any) => {
      this.emit(ControllerEventType.SHUTDOWN, {
        timestamp: new Date(),
        data,
      });
    });
  }

  /**
   * Emit an event to all registered listeners
   *
   * @param event - The event type to emit
   * @param eventData - The event data
   */
  private emit(event: ControllerEventType, eventData: Omit<ControllerEventData, 'type'>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const fullEventData: ControllerEventData = {
        type: event,
        ...eventData,
      };

      // Execute all listeners (async)
      for (const listener of listeners) {
        // Don't await - fire and forget for events
        try {
          const result = listener(fullEventData);
          if (result && typeof result.catch === 'function') {
            result.catch((error: Error) => {
              console.error(`Error in event listener for ${event}:`, error);
            });
          }
        } catch (error) {
          console.error(`Sync error in event listener for ${event}:`, error);
        }
      }
    }
  }
}
