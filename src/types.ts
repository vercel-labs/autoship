export interface RepoConfig {
  owner: string;
  repo: string;
  baseBranch: string;
  cloneUrl: string;
  packages?: string[];
}

export interface ReleaseOptions {
  type: 'patch' | 'minor' | 'major';
  message: string;
  skipConfirmations?: boolean;
}

export interface PullRequest {
  number: number;
  html_url: string;
  head: {
    ref: string;
    sha: string;
  };
  state: string;
  mergeable?: boolean | null;
  merged?: boolean;
}

export interface CheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}
