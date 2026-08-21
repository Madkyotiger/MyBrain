#!/usr/bin/env bun
import { parseFlags, requiredFlag } from './common.ts';
import { createBackup, restoreBackup, verifyBackup } from './backup.ts';
import { buildMeetingPrep, recordCorrection } from './hero-loops.ts';
import { intakeFile, type DataClass } from './intake.ts';
import { configureHermesAdapter } from './hermes-adapter.ts';
import { initializeMyBrain, loadAnswers, onboardingPlan } from './onboarding.ts';
import { runGbrain } from './gbrain-runtime.ts';

const HELP = `MyBrain CN P1\n\nUsage:\n  mybrain-cn plan --answers <json> --workspace <abs> --state-root <abs>\n  mybrain-cn init --answers <json> --workspace <abs> --state-root <abs> --confirm-hash <sha256> --hermes-config <abs> [--force]\n  mybrain-cn runtime hermes --config <abs> --state-root <abs> [--source-id default] [--force]\n  mybrain-cn intake --file <abs> --workspace <abs> --class <class> --source-id <id> [--sync --state-root <abs>]\n  mybrain-cn meeting-prep --query <text> --state-root <abs>\n  mybrain-cn correct --fact <text> --provenance <text> --state-root <abs> [--entity <name>]\n  mybrain-cn backup --workspace <abs> --state-root <abs> --output <abs>\n  mybrain-cn backup-verify --backup <abs>\n  mybrain-cn restore --backup <abs> --target-workspace <abs> --target-state-root <abs> [--force]\n  mybrain-cn doctor --state-root <abs>\n\nP1 defaults: local PGLite, Hermes MEMORY_VERBS surface, explicit-source intake, blocked restricted/client-secret data.\n`;

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
        gbrainCli,
        force: booleans.has('--force'),
      }));
      return;
    }
    case 'runtime': {
      if (positionals[0] !== 'hermes') throw new Error('P1 runtime adapter implemented: hermes.');
      output(configureHermesAdapter({
        configPath: requiredFlag(values, '--config'),
        stateRoot: requiredFlag(values, '--state-root'),
        sourceId: values.get('--source-id') ?? 'default',
        gbrainCli,
        force: booleans.has('--force'),
      }));
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
