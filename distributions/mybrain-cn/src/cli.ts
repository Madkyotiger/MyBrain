#!/usr/bin/env bun
import { parseFlags, requiredFlag } from './common.ts';
import { createBackup, restoreBackup, verifyBackup } from './backup.ts';
import {
  buildMeetingPrep,
  buildProjectBrief,
  buildWeeklyEvolution,
  recordCorrection,
} from './hero-loops.ts';
import { intakeFile, type DataClass } from './intake.ts';
import { configureHermesAdapter } from './hermes-adapter.ts';
import { configureWorkBuddyAdapter } from './workbuddy-adapter.ts';
import { configureDeepSeekHarnessAdapter } from './deepseek-harness-adapter.ts';
import { createFeishuAilyHandoff } from './feishu-aily-handoff.ts';
import { activateMyBrain, verifyMyBrain } from './activation.ts';
import { runGbrain } from './gbrain-runtime.ts';

const HELP = `@MyBrain CN\n\nPrimary bootstrap:\n  Follow distributions/mybrain-cn/BOOTSTRAP_FOR_AGENTS.md. GBrain native bootstrap owns preflight, engine, interview, render, skills, harness wiring, repo, and verify.\n\nDistribution commands:\n  mybrain-cn activate --workspace <abs> --state-root <abs> [--force]\n  mybrain-cn verify --workspace <abs> --state-root <abs>\n  mybrain-cn runtime hermes --config <abs> --workspace <abs> --state-root <abs> [--source-id <registered-id>] [--force]\n  mybrain-cn runtime workbuddy --config <abs> --workspace <abs> --state-root <abs> [--source-id <registered-id>] [--force]\n  mybrain-cn runtime deepseek-harness --patch <abs> --workspace <abs> --state-root <abs> [--source-id <registered-id>] [--force]\n  mybrain-cn runtime feishu-aily --url <https-url> --output <abs> [--auth-header Authorization]\n  mybrain-cn intake --file <abs> --workspace <abs> --class <class> [--source-id <native-id>] [--sync --state-root <abs>]\n  mybrain-cn meeting-prep --query <text> --state-root <abs> [--entity <name-or-slug>]\n  mybrain-cn project-brief --query <text> --state-root <abs> [--entity <name-or-slug>]\n  mybrain-cn weekly-evolution --state-root <abs> [--query <text>] [--since <iso-date>]\n  mybrain-cn correct --fact <text> --provenance <text> --state-root <abs> [--entity <name>]\n  mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>\n  mybrain-cn backup-verify --backup <abs>\n  mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs> [--force]\n  mybrain-cn doctor --state-root <abs>\n\nAutomatic native bootstrap hosts: Claude Code, Codex, and opencode. Hermes, WorkBuddy, and DeepSeek Harness attach after native bootstrap. Feishu Aily uses a remote MCP registration handoff. Doubao Desktop is not claimed until an official extension/MCP interface is available.\n`;
const WORKFLOW_HELP = `${HELP}\nEvidence workflow source isolation: meeting-prep, project-brief, weekly-evolution, and correct accept --source-id <registered-id>.\n`;

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(WORKFLOW_HELP);
    return;
  }
  const { values, booleans, positionals } = parseFlags(rest);
  const gbrainCli = values.get('--gbrain-cli');

  switch (command) {
    case 'activate': {
      output(activateMyBrain({
        workspace: requiredFlag(values, '--workspace'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
        force: booleans.has('--force'),
      }));
      return;
    }
    case 'verify': {
      output(verifyMyBrain({
        workspace: requiredFlag(values, '--workspace'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
      }));
      return;
    }
    case 'runtime': {
      const runtime = positionals[0];
      if (runtime === 'hermes') {
        output(configureHermesAdapter({
          configPath: requiredFlag(values, '--config'), stateRoot: requiredFlag(values, '--state-root'),
          workspace: requiredFlag(values, '--workspace'), sourceId: values.get('--source-id'),
          gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'workbuddy') {
        output(configureWorkBuddyAdapter({
          configPath: requiredFlag(values, '--config'), stateRoot: requiredFlag(values, '--state-root'),
          workspace: requiredFlag(values, '--workspace'), sourceId: values.get('--source-id'),
          gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'deepseek-harness') {
        output(configureDeepSeekHarnessAdapter({
          patchPath: requiredFlag(values, '--patch'), workspace: requiredFlag(values, '--workspace'),
          stateRoot: requiredFlag(values, '--state-root'), sourceId: values.get('--source-id'),
          gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'feishu-aily') {
        output(createFeishuAilyHandoff({
          endpointUrl: requiredFlag(values, '--url'), outputPath: requiredFlag(values, '--output'),
          authHeader: values.get('--auth-header'),
        }));
      } else {
        throw new Error('Supported runtime targets: hermes, workbuddy, deepseek-harness, feishu-aily.');
      }
      return;
    }
    case 'intake': {
      output(intakeFile({
        inputPath: requiredFlag(values, '--file'),
        workspace: requiredFlag(values, '--workspace'),
        dataClass: requiredFlag(values, '--class') as DataClass,
        sourceId: values.get('--source-id'),
        stateRoot: values.get('--state-root'),
        sync: booleans.has('--sync'),
        gbrainCli,
      }));
      return;
    }
    case 'meeting-prep': {
      output(buildMeetingPrep({
        query: requiredFlag(values, '--query'),
        entity: values.get('--entity'),
        sourceId: values.get('--source-id'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
      }));
      return;
    }
    case 'project-brief': {
      output(buildProjectBrief({
        query: requiredFlag(values, '--query'),
        entity: values.get('--entity'),
        sourceId: values.get('--source-id'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
      }));
      return;
    }
    case 'weekly-evolution': {
      output(buildWeeklyEvolution({
        query: values.get('--query')?.trim() || '本周判断变化',
        since: values.get('--since'),
        sourceId: values.get('--source-id'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
      }));
      return;
    }
    case 'correct': {
      output(recordCorrection({
        fact: requiredFlag(values, '--fact'),
        provenance: requiredFlag(values, '--provenance'),
        entity: values.get('--entity'),
        sourceId: values.get('--source-id'),
        stateRoot: requiredFlag(values, '--state-root'),
        gbrainCli,
      }));
      return;
    }
    case 'backup': {
      output(createBackup({
        workspace: requiredFlag(values, '--workspace'),
        stateRoot: requiredFlag(values, '--state-root'),
        output: requiredFlag(values, '--output'),
      }));
      return;
    }
    case 'backup-verify': {
      output(verifyBackup(requiredFlag(values, '--backup')));
      return;
    }
    case 'restore': {
      output(restoreBackup({
        backup: requiredFlag(values, '--backup'),
        targetWorkspace: requiredFlag(values, '--target-workspace'),
        targetStateRoot: requiredFlag(values, '--target-state-root'),
        force: booleans.has('--force'),
      }));
      return;
    }
    case 'doctor': {
      const stateRoot = requiredFlag(values, '--state-root');
      const doctor = runGbrain(['doctor', '--json'], { stateRoot, gbrainCli, allowFailure: true });
      const schema = runGbrain(['schema', 'validate', 'mybrain-cn-executive', '--json'], { stateRoot, gbrainCli, allowFailure: true });
      output({
        schema_version: 'mybrain-cn-doctor-v1',
        ok: doctor.code === 0 && schema.code === 0,
        gbrain_doctor: { code: doctor.code, stdout: doctor.stdout.trim(), stderr: doctor.stderr.trim() },
        schema_pack: { code: schema.code, stdout: schema.stdout.trim(), stderr: schema.stderr.trim() },
      });
      if (doctor.code !== 0 || schema.code !== 0) process.exitCode = 1;
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}\n\n${WORKFLOW_HELP}`);
  }
}

main().catch((error) => {
  process.stderr.write(`mybrain-cn: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
