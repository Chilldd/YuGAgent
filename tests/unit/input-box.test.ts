/**
 * @fileoverview Unit tests for InputBox component input handling logic
 */

import { describe, it, expect } from 'vitest';

describe('InputBox Input Handling', () => {
  describe('Backspace Handling', () => {
    it('should delete character at cursor position when not at end', () => {
      const state = { value: 'hello world', cursorPosition: 5 };
      // Cursor at 'o' in 'hello| world'
      const newValue =
        state.cursorPosition === state.value.length
          ? state.value.slice(0, -1)
          : state.value.slice(0, state.cursorPosition - 1) + state.value.slice(state.cursorPosition);

      expect(newValue).toBe('hell world');
      expect(newValue.length).toBe(state.value.length - 1);
    });

    it('should delete last character when cursor at end', () => {
      const state = { value: 'hello', cursorPosition: 5 };
      const newValue =
        state.cursorPosition === state.value.length
          ? state.value.slice(0, -1)
          : state.value.slice(0, state.cursorPosition - 1) + state.value.slice(state.cursorPosition);

      expect(newValue).toBe('hell');
    });

    it('should not delete when cursor at position 0', () => {
      const state = { value: 'hello', cursorPosition: 0 };
      const shouldDelete = state.value.length > 0 && state.cursorPosition > 0;
      expect(shouldDelete).toBe(false);
    });

    it('should not delete when value is empty', () => {
      const state = { value: '', cursorPosition: 0 };
      const shouldDelete = state.value.length > 0 && state.cursorPosition > 0;
      expect(shouldDelete).toBe(false);
    });
  });

  describe('Delete Key Handling', () => {
    it('should delete character after cursor position', () => {
      const state = { value: 'hello', cursorPosition: 2 };
      // Cursor at 'hel|lo'
      const newValue = state.value.slice(0, state.cursorPosition) + state.value.slice(state.cursorPosition + 1);
      expect(newValue).toBe('helo');
    });

    it('should not delete when cursor at end', () => {
      const state = { value: 'hello', cursorPosition: 5 };
      const shouldDelete = state.cursorPosition < state.value.length;
      expect(shouldDelete).toBe(false);
    });
  });

  describe('Character Insertion', () => {
    it('should insert character at cursor position when not at end', () => {
      const state = { value: 'hlo', cursorPosition: 1 };
      const char = 'e';
      const newValue =
        state.cursorPosition === state.value.length
          ? state.value + char
          : state.value.slice(0, state.cursorPosition) + char + state.value.slice(state.cursorPosition);

      expect(newValue).toBe('helo');
    });

    it('should append character when cursor at end', () => {
      const state = { value: 'hel', cursorPosition: 3 };
      const char = 'o';
      const newValue =
        state.cursorPosition === state.value.length
          ? state.value + char
          : state.value.slice(0, state.cursorPosition) + char + state.value.slice(state.cursorPosition);

      expect(newValue).toBe('helo');
    });

    it('should not exceed maxLength', () => {
      const state = { value: 'hello', cursorPosition: 5 };
      const char = '!';
      const maxLength = 5;
      const newValue =
        state.cursorPosition === state.value.length
          ? state.value + char
          : state.value.slice(0, state.cursorPosition) + char + state.value.slice(state.cursorPosition);

      const shouldUpdate = newValue.length <= maxLength;
      expect(shouldUpdate).toBe(false);
    });
  });

  describe('Cursor Movement', () => {
    it('should move left arrow correctly', () => {
      const cursorPosition = 5;
      const newPosition = Math.max(0, cursorPosition - 1);
      expect(newPosition).toBe(4);
    });

    it('should not move left when at position 0', () => {
      const cursorPosition = 0;
      const newPosition = Math.max(0, cursorPosition - 1);
      expect(newPosition).toBe(0);
    });

    it('should move right arrow correctly', () => {
      const state = { value: 'hello', cursorPosition: 2 };
      const newPosition = Math.min(state.value.length, state.cursorPosition + 1);
      expect(newPosition).toBe(3);
    });

    it('should not move right when at end', () => {
      const state = { value: 'hello', cursorPosition: 5 };
      const newPosition = Math.min(state.value.length, state.cursorPosition + 1);
      expect(newPosition).toBe(5);
    });
  });
});
