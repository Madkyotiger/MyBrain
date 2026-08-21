#!/usr/bin/env bun
import { parseFlags, requiredFlag } from './common.ts';
import { createBackup, restoreBackup, verifyBackup } from './backup.ts';
import { buildMeetingPrep, recordCorrection } from './hero-loops.ts';
import { intakeFile, type DataClass } from './intake.ts';
import { configureHermesAdapter } from './hermes-adapter.ts';
import { configureWorkBuddyAdapter } from './workbuddy-adapter.ts';
import { configureDeepSeekHarnessAdapter } from './deepseek-harness-adapter.ts';
import { createDoubaoWorkHandoff } from './doubao-work-handoff.ts';
import { initializeMyBrain, loadAnswers, onboardingPlan } from './onboarding.ts';
import { runGbrain } from './gbrain-runtime.ts';
import { runTerminalOnboarding } from './interactive-onboarding.ts';

const HELP = `@MyBrain P1.2\n\nUsage:\n  mybrain-cn onboard [--force]\n  mybrain-cn plan --answers <json> --workspace <abs> --state-root <abs>\n  mybrain-cn init --answers <json> --workspace <abs> --state-root <abs> --confirm-hash <sha256> [--hermes-config <abs> | --workbuddy-config <abs> | --deepseek-harness-patch <abs>] [--force]\n  mybrain-cn runtime hermes --config <abs> --state-root <abs> [--source-id default] [--force]\n  mybrain-cn runtime workbuddy --config <abs> --state-root <abs> [--source-id default] [--force]\n  mybrain-cn runtime deepseek-harness --patch <abs> --workspace <abs> --state-root <abs> [--source-id default] [--force]\n  mybrain-cn runtime doubao-work --url <https-url> --output <abs> [--auth-header Authorization]\n  mybrain-cn intake --file <abs> --workspace <abs> --class <class> --source-id <id> [--sync --state-root <abs>]\n  mybrain-cn meeting-prep --query <text> --state-root <abs>\n  mybrain-cn correct --fact <text> --provenance <text> --state-root <abs> [--entity <name>]\n  mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>\n  mybrain-cn backup-verify --backup <abs>\n  mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs> [--force]\n  mybrain-cn doctor --state-root <abs>\n\nP1.2 defaults: explicit confirmations, local PGLite, bounded MEMORY_VERBS, explicit-source intake, blocked restricted/client-secret data. 豆包工作伙伴仅生成远程 MCP 登记交接，不部署远程服务。\n`;

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(HELP);
    return;
  }
  const { values, booleans, positionals } = parseFlags(rest);
  const gbrainCli = values.get('--gbrain-cli');

  switch (command) {
    case 'onboard': {
      output(await runTerminalOnboarding({ gbrainCli, force: booleans.has('--force') }));
      return;
    }
    case 'plan': {
      const answers = loadAnswers(requiredFlag(values, '--answers'));
      output(onboardingPlan(answers, requiredFlag(values, '--workspace'), requiredFlag(values, '--state-root')));
      return;
    }
    case 'init': {
      output(initializeMyBrain({
        answersPath: requiredFlag(values, '--answers'),
        workspace: requiredFlag(values, '--workspace'),
        stateRoot: requiredFlag(values, '--state-root'),
        confirmationHash: requiredFlag(values, '--confirm-hash'),
        hermesConfig: values.get('--hermes-config'),
        workbuddyConfig: values.get('--workbuddy-config'),
        deepseekHarnessPatch: values.get('--deepseek-harness-patch'),
        gbrainCli,
        force: booleans.has('--force'),
      }));
      return;
    }
    case 'runtime': {
      const runtime = positionals[0];
      if (runtime === 'hermes') {
        output(configureHermesAdapter({
          configPath: requiredFlag(values, '--config'), stateRoot: requiredFlag(values, '--state-root'),
          sourceId: values.get('--source-id') ?? 'default', gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'workbuddy') {
        output(configureWorkBuddyAdapter({
          configPath: requiredFlag(values, '--config'), stateRoot: requiredFlag(values, '--state-root'),
          sourceId: values.get('--source-id') ?? 'default', gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'deepseek-harness') {
        output(configureDeepSeekHarnessAdapter({
          patchPath: requiredFlag(values, '--patch'), workspace: requiredFlag(values, '--workspace'),
          stateRoot: requiredFlag(values, '--state-root'), sourceId: values.get('--source-id') ?? 'default',
          gbrainCli, force: booleans.has('--force'),
        }));
      } else if (runtime === 'doubao-work') {
        output(createDoubaoWorkHandoff({
          endpointUrl: requiredFlag(values, '--url'), outputPath: requiredFlag(values, '--output'),
          authHeader: values.get('--auth-header'),
        }));
      } else {
        throw new Error('Supported runtime targets: hermes, workbuddy, deepseek-harness, doubao-work.');
      }
      return;
    }
    case 'intake': {
      output(intakeFile({
        inputPath: requiredFlag(values, '--file'),
        workspace: requiredFlag(values, '--workspace'),
        dataClass: requiredFlag(values, '--class') as DataClass,
        sourceId: requiredFlag(values, '--source-id'),
        stateRoot: values.get('--state-root'),
        sync: booleans.has('--sync'),
        gbrainCli,
      }));
      return;
    }
    case 'meeting-prep': {
      output(buildMeetingPrep({
        query: requiredFlag(values, '--query'),
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
      throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  }
}

main().catch((error) => {
  process.stderr.write(`mybrain-cn: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
