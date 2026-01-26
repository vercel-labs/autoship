import { RepoConfig } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Built-in repository configurations (users can add more via `mkrelease add`)
const REPO_CONFIGS: Record<string, RepoConfig> = {};

const CONFIG_DIR = path.join(os.homedir(), '.autoship');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface StoredConfig {
  repos: Record<string, RepoConfig>;
}

function loadStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors, return default
  }
  return { repos: {} };
}

function saveConfig(config: StoredConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function getRepoConfig(repoName: string): RepoConfig | null {
  // Check built-in configs first
  if (REPO_CONFIGS[repoName]) {
    return REPO_CONFIGS[repoName];
  }

  // Check stored configs
  const stored = loadStoredConfig();
  if (stored.repos[repoName]) {
    return stored.repos[repoName];
  }

  return null;
}

export function addRepoConfig(name: string, config: RepoConfig): void {
  const stored = loadStoredConfig();
  stored.repos[name] = config;
  saveConfig(stored);
}

export function listRepos(): string[] {
  const stored = loadStoredConfig();
  return [...Object.keys(REPO_CONFIGS), ...Object.keys(stored.repos)];
}

export function getTempDir(): string {
  return path.join(os.tmpdir(), 'autoship');
}
