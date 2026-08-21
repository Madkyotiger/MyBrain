import { resolve } from 'node:path';
import { requireAbsolute, writeJson } from './common.ts';

export interface FeishuAilyHandoffOptions {
  endpointUrl: string;
  outputPath: string;
  authHeader?: string;
}

export interface FeishuAilyHandoffReceipt {
  schema_version: 'mybrain-cn-feishu-aily-handoff-v1';
  output_path: string;
  endpoint_url: string;
  transport: 'streamable-http';
  visibility: 'self-only';
  deployment_included: false;
  credentials_included: false;
  live_client_check: 'not-run';
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local')) return true;
  if (host === '::1' || host === '[::1]') return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = ipv4.slice(1).map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

export function createFeishuAilyHandoff(options: FeishuAilyHandoffOptions): FeishuAilyHandoffReceipt {
  const outputPath = requireAbsolute(options.outputPath, 'Feishu Aily handoff output path');
  const endpoint = new URL(options.endpointUrl);
  if (endpoint.protocol !== 'https:') throw new Error('Feishu Aily remote MCP endpoint must use HTTPS.');
  if (isPrivateHostname(endpoint.hostname)) throw new Error('Feishu Aily cloud handoff refuses localhost or private-network endpoints.');
  if (endpoint.username || endpoint.password) throw new Error('Credentials must not be embedded in the MCP endpoint URL.');
  const authHeader = (options.authHeader ?? 'Authorization').trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(authHeader)) throw new Error('Auth header must be a header name only, not a credential value.');

  writeJson(outputPath, {
    schema_version: 'mybrain-cn-feishu-aily-registration-v1',
    product: 'Feishu Aily',
    registration: {
      name: '@MyBrain',
      description: '用户拥有的私人专业 Brain；仅暴露有来源边界的记忆动词。',
      transport: 'streamable-http',
      endpoint_url: endpoint.toString(),
      authentication: {
        header_name: authHeader,
        value: '<set-inside-feishu-aily-secret-field>',
      },
      visibility: 'self-only',
      recommended_active_mcp_limit: 5,
    },
    safety: {
      deploys_remote_server: false,
      includes_credentials: false,
      exposes_local_pglite: false,
      requires_user_review_before_registration: true,
      requires_separate_remote_host_auth_and_data_residency_review: true,
    },
    support_status: 'registration-handoff-only',
  });

  return {
    schema_version: 'mybrain-cn-feishu-aily-handoff-v1',
    output_path: resolve(outputPath),
    endpoint_url: endpoint.toString(),
    transport: 'streamable-http',
    visibility: 'self-only',
    deployment_included: false,
    credentials_included: false,
    live_client_check: 'not-run',
  };
}
