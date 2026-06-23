const SCRAPE_CRON = "0 */5 * * *";
const SCRAPE_INTERVAL_HOURS = 5;
const SCRAPE_WORKFLOW_ID = "scrape.yml";
const SCRAPE_SCHEDULE_LABEL = "Every 5 hours";

type WorkflowConfig = {
  repository: string | null;
  token: string | null;
  workflowId: string;
  ref: string;
};

export type ScrapeWorkflowStatus = {
  cron: string;
  scheduleLabel: string;
  workflowId: string;
  nextScrapeAt: string;
  canTrigger: boolean;
};

export type ScrapeWorkflowDispatchResult =
  | {
      ok: true;
      message: string;
      repository: string;
      workflowId: string;
      ref: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

function getNextScrapeTime(now = new Date()): Date {
  const next = new Date(now);
  next.setUTCMinutes(0, 0, 0);

  if (next <= now) {
    next.setUTCHours(next.getUTCHours() + 1);
  }

  while (next.getUTCHours() % SCRAPE_INTERVAL_HOURS !== 0) {
    next.setUTCHours(next.getUTCHours() + 1);
  }

  return next;
}

function getRepository(): string | null {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_REPO) return process.env.GITHUB_REPO;

  const vercelOwner = process.env.VERCEL_GIT_REPO_OWNER;
  const vercelRepo = process.env.VERCEL_GIT_REPO_SLUG;
  if (vercelOwner && vercelRepo) return `${vercelOwner}/${vercelRepo}`;

  return null;
}

function getWorkflowConfig(): WorkflowConfig {
  return {
    repository: getRepository(),
    token:
      process.env.GITHUB_WORKFLOW_TOKEN ??
      process.env.GITHUB_TOKEN ??
      process.env.GH_TOKEN ??
      process.env.GITHUB_PAT ??
      null,
    workflowId:
      process.env.SCRAPE_WORKFLOW_ID ??
      process.env.GITHUB_SCRAPE_WORKFLOW_ID ??
      SCRAPE_WORKFLOW_ID,
    ref:
      process.env.SCRAPE_WORKFLOW_REF ??
      process.env.GITHUB_WORKFLOW_REF ??
      process.env.VERCEL_GIT_COMMIT_REF ??
      process.env.GITHUB_REF_NAME ??
      "main",
  };
}

export function getScrapeWorkflowStatus(now = new Date()): ScrapeWorkflowStatus {
  const config = getWorkflowConfig();
  return {
    cron: SCRAPE_CRON,
    scheduleLabel: SCRAPE_SCHEDULE_LABEL,
    workflowId: config.workflowId,
    nextScrapeAt: getNextScrapeTime(now).toISOString(),
    canTrigger: Boolean(config.repository && config.token),
  };
}

export async function dispatchScrapeWorkflow(): Promise<ScrapeWorkflowDispatchResult> {
  const config = getWorkflowConfig();

  if (!config.repository) {
    return {
      ok: false,
      status: 501,
      error:
        "Workflow trigger is not configured. Set GITHUB_REPOSITORY or GITHUB_REPO to owner/repo.",
    };
  }

  if (!config.token) {
    return {
      ok: false,
      status: 501,
      error:
        "Workflow trigger is not configured. Set GITHUB_WORKFLOW_TOKEN, GITHUB_TOKEN, GH_TOKEN, or GITHUB_PAT with actions:write access.",
    };
  }

  const res = await fetch(
    `https://api.github.com/repos/${config.repository}/actions/workflows/${config.workflowId}/dispatches`,
    {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${config.token}`,
        "content-type": "application/json",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({ ref: config.ref }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: body || `GitHub workflow dispatch failed with status ${res.status}.`,
    };
  }

  return {
    ok: true,
    message: "Scrape workflow queued.",
    repository: config.repository,
    workflowId: config.workflowId,
    ref: config.ref,
  };
}
