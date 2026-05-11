const schedule = [2000, 5000, 10000, 20000] as const;

export type RetryDecision = {
  attempts: number;
  shouldRetry: boolean;
  nextRetryInMs: number;
};

export function nextRetryDecision(currentAttempts: number): RetryDecision {
  const attempts = currentAttempts + 1;
  const nextRetryInMs = schedule[currentAttempts] ?? 0;
  return {
    attempts,
    shouldRetry: currentAttempts < schedule.length,
    nextRetryInMs,
  };
}

export function resetRetryState(): RetryDecision {
  return { attempts: 0, shouldRetry: false, nextRetryInMs: 0 };
}

