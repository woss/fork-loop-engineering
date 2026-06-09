#!/usr/bin/env node
import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

type Pattern =
  | 'daily-triage'
  | 'pr-babysitter'
  | 'ci-sweeper'
  | 'dependency-sweeper'
  | 'post-merge-cleanup'
  | 'changelog-drafter';

type Tool = 'grok' | 'claude' | 'codex';

const PATTERN_STARTERS: Record<Pattern, string> = {
  'daily-triage': 'minimal-loop',
  'pr-babysitter': 'pr-babysitter',
  'ci-sweeper': 'ci-sweeper',
  'dependency-sweeper': 'dependency-sweeper',
  'post-merge-cleanup': 'post-merge-cleanup',
  'changelog-drafter': 'changelog-drafter',
};

const TOOL_SUFFIX: Record<Tool, string> = {
  grok: '',
  claude: '-claude',
  codex: '-codex',
};

const STATE_FILES: Record<Pattern, string> = {
  'daily-triage': 'STATE.md',
  'pr-babysitter': 'pr-babysitter-state.md',
  'ci-sweeper': 'ci-sweeper-state.md',
  'dependency-sweeper': 'dependency-sweeper-state.md',
  'post-merge-cleanup': 'post-merge-state.md',
  'changelog-drafter': 'changelog-drafter-state.md',
};

function parseArgs(argv: string[]) {
  let pattern: Pattern = 'daily-triage';
  let tool: Tool = 'grok';
  let target = '.';
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pattern' || a === '-p') pattern = argv[++i] as Pattern;
    else if (a === '--tool' || a === '-t') tool = argv[++i] as Tool;
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--help' || a === '-h') return { help: true as const, pattern, tool, target, dryRun };
    else if (!a.startsWith('-')) target = a;
  }

  return { help: false as const, pattern, tool, target, dryRun };
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src: string, dest: string, dryRun: boolean) {
  if (!(await exists(src))) return false;
  if (dryRun) {
    console.log(`  would copy: ${src} → ${dest}`);
    return true;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest, { recursive: true });
  console.log(`  copied: ${src} → ${dest}`);
  return true;
}

async function copyFile(src: string, dest: string, dryRun: boolean) {
  if (!(await exists(src))) return false;
  if (dryRun) {
    console.log(`  would copy: ${src} → ${dest}`);
    return true;
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
  console.log(`  copied: ${src} → ${dest}`);
  return true;
}

function firstLoopCommand(pattern: Pattern, tool: Tool): string {
  const cmds: Record<Pattern, Record<Tool, string>> = {
    'daily-triage': {
      grok: '/loop 1d Run loop-triage. Update STATE.md. No auto-fix in week one.',
      claude: '/loop 1d $loop-triage — update STATE.md. Report-only week one.',
      codex: 'Automation daily: $loop-triage → update STATE.md. Report-only.',
    },
    'pr-babysitter': {
      grok: '/loop 10m Run pr-review-triage. Update pr-babysitter-state.md. Worktree + minimal-fix + verifier for allowlisted PRs only. Escalate after 3 attempts.',
      claude: '/loop 10m $pr-review-triage — update pr-babysitter-state.md. No auto-merge.',
      codex: 'Automation 10m: pr-review-triage → pr-babysitter-state.md. No auto-merge.',
    },
    'ci-sweeper': {
      grok: '/loop 15m Run ci-triage on failing CI. Update ci-sweeper-state.md. Fix only regressions in worktree. Max 3 attempts.',
      claude: '/loop 15m $ci-triage — update ci-sweeper-state.md. Max 3 fix attempts.',
      codex: 'Automation 15m: ci-triage on CI failures. Max 3 attempts.',
    },
    'dependency-sweeper': {
      grok: '/loop 6h Run dependency-triage. Patch-only auto-fix in worktree + verifier. Escalate majors and denylist.',
      claude: '/loop 6h $dependency-triage — patch-only with verifier. Escalate risky bumps.',
      codex: 'Automation 6h: dependency-triage. Patch-only with verifier.',
    },
    'post-merge-cleanup': {
      grok: '/loop 1d Run post-merge-scan on recent merges. Update post-merge-state.md. Small fixes only in worktree.',
      claude: '/loop 1d $post-merge-scan — update post-merge-state.md. Small fixes only.',
      codex: 'Automation daily: post-merge-scan → post-merge-state.md.',
    },
    'changelog-drafter': {
      grok: '/loop 1d Run changelog-scan on merges since last tag. Produce categorized draft in RELEASE_NOTES_DRAFT.md using draft-release-notes. Update changelog-drafter-state.md. Human review only.',
      claude: '/loop 1d $changelog-scan + draft-release-notes — write RELEASE_NOTES_DRAFT.md and update state. Human approves before publish.',
      codex: 'Automation daily: changelog-scan + draft-release-notes → RELEASE_NOTES_DRAFT.md. Human review.',
    },
  };
  return cmds[pattern][tool];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`loop-init — scaffold loop engineering starters

Usage:
  loop-init [target-dir] --pattern <name> --tool <grok|claude|codex>

Patterns:
  daily-triage (default)
  pr-babysitter
  ci-sweeper
  dependency-sweeper
  post-merge-cleanup
  changelog-drafter (new low-risk release notes pattern)

Options:
  -p, --pattern   Pattern to scaffold
  -t, --tool      Tool target (default: grok)
  --dry-run       Print actions without copying
  -h, --help      This help

Examples:
  npx @cobusgreyling/loop-init . --pattern daily-triage --tool grok
  npx @cobusgreyling/loop-init . -p pr-babysitter -t claude
`);
    process.exit(0);
  }

  const { pattern, tool, target, dryRun } = args;
  const targetDir = path.resolve(target);
  const baseStarter = PATTERN_STARTERS[pattern];
  const suffix = TOOL_SUFFIX[tool];
  const starterName = pattern === 'daily-triage' ? `minimal-loop${suffix}` : baseStarter;
  const starterRoot = path.join(REPO_ROOT, 'starters', starterName);

  if (!(await exists(starterRoot))) {
    // Fall back to grok starter for patterns without per-tool variants
    const fallback = path.join(REPO_ROOT, 'starters', baseStarter);
    if (!(await exists(fallback))) {
      console.error(`Starter not found: ${starterRoot}`);
      process.exit(1);
    }
    console.log(`Note: no ${tool} variant for ${pattern} — using ${baseStarter} (Grok paths)`);
  }

  const effectiveStarter = (await exists(starterRoot))
    ? starterRoot
    : path.join(REPO_ROOT, 'starters', baseStarter);

  console.log(`\nloop-init: ${pattern} → ${targetDir} (${tool})${dryRun ? ' [dry-run]' : ''}\n`);

  const skillRoots = [
    path.join(effectiveStarter, '.grok', 'skills'),
    path.join(effectiveStarter, '.claude', 'skills'),
    path.join(effectiveStarter, '.codex', 'skills'),
  ];

  for (const skillsDir of skillRoots) {
    if (!(await exists(skillsDir))) continue;
    const toolPrefix = skillsDir.includes('.grok')
      ? '.grok/skills'
      : skillsDir.includes('.claude')
        ? '.claude/skills'
        : '.codex/skills';
    const entries = await readDirNames(skillsDir);
    for (const entry of entries) {
      await copyDir(
        path.join(skillsDir, entry),
        path.join(targetDir, toolPrefix, entry),
        dryRun,
      );
    }
  }

  const agentFiles = [
    { src: path.join(effectiveStarter, '.claude', 'agents'), dest: path.join(targetDir, '.claude', 'agents') },
    { src: path.join(effectiveStarter, '.codex', 'agents'), dest: path.join(targetDir, '.codex', 'agents') },
  ];
  for (const { src, dest } of agentFiles) {
    if (await exists(src)) {
      const entries = await readDirNames(src);
      for (const entry of entries) {
        await copyFile(path.join(src, entry), path.join(dest, entry), dryRun);
      }
    }
  }

  const stateFile = STATE_FILES[pattern];
  const stateExample = path.join(effectiveStarter, `${stateFile}.example`);
  if (await exists(stateExample)) {
    await copyFile(stateExample, path.join(targetDir, stateFile), dryRun);
  } else {
    const alt = path.join(effectiveStarter, 'STATE.md.example');
    if (await exists(alt)) {
      await copyFile(alt, path.join(targetDir, stateFile), dryRun);
    }
  }

  const loopMd = path.join(effectiveStarter, 'LOOP.md');
  if (await exists(loopMd)) {
    await copyFile(loopMd, path.join(targetDir, 'LOOP.md'), dryRun);
  }

  if (!dryRun && !(await exists(path.join(targetDir, 'AGENTS.md')))) {
    const agentsTemplate = `# AGENTS.md

## Test commands
npm test
npm run lint

## Loop conventions
- Report-only week one (L1) before enabling auto-fix (L2)
- See LOOP.md for cadence and human gates
`;
    await writeFile(path.join(targetDir, 'AGENTS.md'), agentsTemplate);
    console.log('  created: AGENTS.md (template)');
  }

  console.log('\n=== Next steps ===');
  console.log(`  npx @cobusgreyling/loop-audit ${target === '.' ? '.' : target} --suggest`);
  console.log(`  First loop command (${tool}):\n  ${firstLoopCommand(pattern, tool)}\n`);
}

async function readDirNames(dir: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() || e.isFile()).map((e) => e.name);
}

main().catch((err) => {
  console.error('loop-init failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});