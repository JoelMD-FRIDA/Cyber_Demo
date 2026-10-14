// Private readiness only. No redirects, paid provider calls or credential output.
try {
  const response = await fetch('http://127.0.0.1:3000/api/health/ready', {
    redirect: 'error', signal: AbortSignal.timeout(4000), cache: 'no-store',
  });
  const body = await response.json();
  process.exit(response.status === 200 && body?.status === 'ready' ? 0 : 1);
} catch {
  process.exit(1);
}
