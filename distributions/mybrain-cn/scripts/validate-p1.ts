import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateP0 } from './validate-p0.ts';

const ROOT = resolve(import.meta.dir, '..');
type JsonObject = Record<string, any>;

function readJson(rel: string): JsonObject {
  return JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as JsonObject;
}

export function validateP1() {
  const p0 = validateP0();
  const manifest = readJson('manifest.json');
  if (manifest.schema_version !== 'mybrain-cn-release-candidate-v1' || manifest.status !== 'release-candidate') {
    throw new Error('release manifest identity is invalid');
  }
  if (manifest.architecture?.bootstrap_owner !== 'gbrain-native' || manifest.architecture?.parallel_onboarding !== false) {
    throw new Error('GBrain native bootstrap must be the single production owner');
  }
  if (manifest.release?.mcp_surface !== 'verbs' || manifest.release?.source_guard !== true) {
    throw new Error('release must expose the bounded source-guarded verbs surface');
  }
  if (manifest.release?.source_id_owner !== 'agent.json.source_id') {
    throw new Error('native agent.json must own the default source id');
  }
  for (const rel of manifest.release.required_files as string[]) {
    if (!existsSync(join(ROOT, rel))) throw new Error(`release required file missing: ${rel}`);
  }

  const expectedSkills = manifest.product.mvp_skills as string[];
  const skillpack = readJson('skill-pack/skillpack.json');
  if (skillpack.api_version !== 'gbrain-skillpack-v1' || skillpack.schema_pack !== 'mybrain-cn-executive') {
    throw new Error('native third-party Skillpack contract is invalid');
  }
  const expectedPaths = expectedSkills.map((name) => `skills/${name}`);
  if (JSON.stringify(skillpack.skills) !== JSON.stringify(expectedPaths)) {
    throw new Error('Skillpack paths do not match the release skill set');
  }
  const actualSkills = readdirSync(join(ROOT, 'skill-pack', 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (actualSkills.length !== 8 || JSON.stringify(actualSkills) !== JSON.stringify([...expectedSkills].sort())) {
    throw new Error(`release skill pack mismatch: ${actualSkills.join(', ')}`);
  }
  for (const name of actualSkills) {
    const text = readFileSync(join(ROOT, 'skill-pack', 'skills', name, 'SKILL.md'), 'utf8');
    if (!text.includes(`name: ${name}`) || text.length < 300) throw new Error(`Skill is missing or too thin: ${name}`);
  }

  const workflowKernel = readFileSync(join(ROOT, 'src/evidence-workflow.ts'), 'utf8');
  for (const marker of ['evidence_ids', 'attempted_queries', 'weekly-evolution', 'project-brief']) {
    if (!workflowKernel.includes(marker)) throw new Error(`evidence workflow kernel is missing contract marker: ${marker}`);
  }
  const heroLoops = readFileSync(join(ROOT, 'src/hero-loops.ts'), 'utf8');
  for (const fn of ['buildMeetingPrep', 'buildProjectBrief', 'buildWeeklyEvolution', 'recordCorrection']) {
    if (!heroLoops.includes(`function ${fn}`)) throw new Error(`hero-loop runtime is missing ${fn}`);
  }
  const cli = readFileSync(join(ROOT, 'src/cli.ts'), 'utf8');
  const workflowCommands = ['meeting-prep', 'project-brief', 'weekly-evolution', 'correct'];
  for (const command of workflowCommands) {
    if (!cli.includes(`case '${command}'`)) throw new Error(`distribution CLI is missing workflow command: ${command}`);
  }

  const acceptance = readJson('mvp-acceptance.json');
  const build = acceptance.release_build as JsonObject[];
  if (build.length !== 9 || build.some((item) => item.status !== 'pass')) {
    throw new Error('all nine release build proofs must be pass');
  }
  const owner = (acceptance.phase1_entry as JsonObject[]).find((item) => item.id === 'P1-OWNER');
  if (!owner || owner.status !== 'pass') throw new Error('accountable owner gate must be pass');
  const support = (acceptance.phase1_entry as JsonObject[]).find((item) => item.id === 'P1-SUPPORT');
  if (!support || support.status !== 'deferred') throw new Error('support owner must remain an explicit pilot gate');

  const adapter = readFileSync(join(ROOT, 'src/hermes-adapter.ts'), 'utf8');
  if (!adapter.includes("['run', gbrainCli, 'serve', '--surface', 'verbs', '--source-guard']")) {
    throw new Error('Hermes adapter must remain verbs-only and source-guarded');
  }

  return {
    status: 'pass',
    p0_status: p0.status,
    bootstrap_owner: manifest.architecture.bootstrap_owner,
    release_build_proofs: build.map((item) => item.id),
    skills: actualSkills,
    workflow_commands: workflowCommands,
    mcp_surface: manifest.release.mcp_surface,
    remaining_human_gates: (acceptance.human_validation as JsonObject[])
      .filter((item) => item.status === 'not-run')
      .map((item) => item.id),
  };
}

if (import.meta.main) console.log(JSON.stringify(validateP1(), null, 2));
