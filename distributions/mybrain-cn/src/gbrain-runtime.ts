import { spawnSync } from 'node:child_process';
import { GBRAIN_CLI, requireAbsolute } from './common.ts';

export interface RunGbrainOptions {
  stateRoot: string;
  cwd?: string;
  gbrainCli?: string;
  env?: NodeJS.ProcessEnv;
  allowFailure?: boolean;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runGbrain(args: string[], options: RunGbrainOptions): RunResult {
  const stateRoot = requireAbsolute(options.stateRoot, 'GBrain state root');
  const cli = requireAbsolute(options.gbrainCli ?? GBRAIN_CLI, 'GBrain CLI path');
  const result = spawnSync('bun', [cli, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env, GBRAIN_HOME: stateRoot },
    encoding: 'utf8',
    timeout: 180_000,
  });
  const code = result.status ?? (result.error ? 1 : 0);
  const receipt = { code, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  if (code !== 0 && !options.allowFailure) {
    throw new Error(
      `gbrain ${args.join(' ')} failed (${code})\n${receipt.stderr || receipt.stdout || result.error?.message || 'unknown error'}`,
    );
  }
  return receipt;
}

export function callVerb(
  verb: string,
  params: Record<string, unknown>,
  options: RunGbrainOptions,
): Record<string, unknown> {
  const result = runGbrain(['call', verb, JSON.stringify(params)], options);
  const outer = JSON.parse(result.stdout) as Record<string, unknown> & {
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  };
  // `gbrain call` is a trusted local path and returns the operation result
  // directly. A remote MCP client returns the standard content[] envelope.
  // Accept both so this overlay can verify local fresh-process round trips
  // without pretending they are remote MCP calls.
  const text = outer.content?.find((item) => item.type === 'text')?.text;
  if (text) {
    const body = JSON.parse(text) as Record<string, unknown>;
    if (outer.isError) throw new Error(`gbrain ${verb} error: ${text}`);
    return body;
  }
  if (typeof outer.error === 'string') throw new Error(`gbrain ${verb} error: ${JSON.stringify(outer)}`);
  return outer;
}
