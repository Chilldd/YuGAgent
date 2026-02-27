import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DirectoryListTool } from '../../src/infrastructure/tool-executor/tools/directory-list-tool.js';

describe('DirectoryListTool', () => {
  it('marks results as truncated when recursion hits max depth', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dir-list-depth-'));
    const level1 = join(root, 'level1');
    const level2 = join(level1, 'level2');

    await mkdir(level2, { recursive: true });
    await writeFile(join(level2, 'deep.txt'), 'deep file');

    const tool = new DirectoryListTool(100, 2);
    const result = await tool.execute({ path: root, recursive: true });

    expect(result.truncated).toBe(true);
    expect(result.entries.some((entry) => entry.path.endsWith('/level1/level2/deep.txt'))).toBe(false);
  });

  it('marks results as truncated when max entries limit is reached', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dir-list-entries-'));

    await writeFile(join(root, 'a.txt'), 'a');
    await writeFile(join(root, 'b.txt'), 'bb');

    const tool = new DirectoryListTool(1, 10);
    const result = await tool.execute({ path: root });

    expect(result.truncated).toBe(true);
    expect(result.count).toBe(1);
  });

  it('recursively includes files under hidden directories when showHidden is enabled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dir-list-hidden-'));
    const hiddenDir = join(root, '.hidden');

    await mkdir(hiddenDir, { recursive: true });
    await writeFile(join(hiddenDir, 'inside.txt'), 'secret');

    const tool = new DirectoryListTool(100, 10);
    const result = await tool.execute({ path: root, recursive: true, showHidden: true });

    expect(result.entries.some((entry) => entry.path.endsWith('/.hidden'))).toBe(true);
    expect(result.entries.some((entry) => entry.path.endsWith('/.hidden/inside.txt'))).toBe(true);
  });
});
