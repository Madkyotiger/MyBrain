import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runConformance } from '../../../../src/core/verbs/conformance.ts';

export async function runBoundedStdioConformance(options: {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  cwd?: string;
}) {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(options.env)) if (value !== undefined) env[key] = value;
  const transport = new StdioClientTransport({ command: options.command, args: options.args, env, cwd: options.cwd });
  const client = new Client({ name: 'mybrain-cn-bounded-conformance', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport, { timeout: 180_000 });
  try {
    const listed = await client.listTools();
    const advertised = new Set(listed.tools.map((tool) => tool.name));
    const report = await runConformance({
      listTools: async () => listed.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        annotations: tool.annotations,
      })),
      callTool: async (name, args) => {
        // The upstream runner probes put_page before tools/list so it can seed
        // full-surface endpoints. A verbs-only endpoint does not advertise it;
        // avoid sending that known-nonexistent probe into the stdio SDK, then
        // send every advertised verb call to the real server.
        if (!advertised.has(name)) return { isError: true, text: JSON.stringify({ error: 'not_advertised' }) };
        const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 180_000 }) as {
          isError?: boolean;
          content?: Array<{ type?: string; text?: string }>;
        };
        return {
          isError: result.isError,
          text: (result.content ?? []).map((item) => typeof item.text === 'string' ? item.text : '').join('\n'),
        };
      },
    });
    return { report, advertised: [...advertised].sort() };
  } finally {
    await client.close().catch(() => undefined);
    await transport.close().catch(() => undefined);
  }
}
