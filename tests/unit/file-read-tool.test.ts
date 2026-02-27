import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileReadTool } from '../../src/infrastructure/tool-executor/tools/file-read-tool.js';

describe('FileReadTool', () => {
  it('returns zero lines and empty range for empty files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'file-read-empty-'));
    const filePath = join(root, 'empty.txt');
    await writeFile(filePath, '');

    const tool = new FileReadTool();
    const result = await tool.execute({ path: filePath });

    expect(result.content).toBe('');
    expect(result.lines).toBe(0);
    expect(result.range).toEqual({ start: 0, end: 0 });
  });

  it('returns empty content with zero-line range when start line is beyond EOF', async () => {
    const root = await mkdtemp(join(tmpdir(), 'file-read-eof-'));
    const filePath = join(root, 'short.txt');
    await writeFile(filePath, 'a\nb');

    const tool = new FileReadTool();
    const result = await tool.execute({ path: filePath, startLine: 10, endLine: 20 });

    expect(result.content).toBe('');
    expect(result.lines).toBe(0);
    expect(result.range).toEqual({ start: 0, end: 0 });
  });
});
