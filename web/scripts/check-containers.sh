#!/usr/bin/env bash
# GitHub-hosted validation only. Never builds on the production server.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_ENVIRONMENT:-}" != github-hosted ]]; then
  echo 'Run container build checks only on a GitHub-hosted runner.' >&2
  exit 1
fi
docker build --target runner -t frida-domain-app-test .
docker build -f deployment/Dockerfile.tools -t frida-domain-tools-test .
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint node frida-domain-tools-test --input-type=module -e "await import('pg'); await import('tar'); console.log('Tools modules load.');"
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --entrypoint /usr/lib/postgresql/18/bin/pg_dump frida-domain-tools-test --version
container=$(docker run -d --network none --read-only --cap-drop ALL --security-opt no-new-privileges:true \
  --memory 384m --cpus 0.5 --pids-limit 128 \
  --tmpfs /tmp:rw,noexec,nosuid,size=32m,uid=10001,gid=10001 \
  --tmpfs /app/.next/cache:rw,nosuid,size=16m,uid=10001,gid=10001 \
  -e APP_ORIGIN=https://domain.frida.test frida-domain-app-test)
trap 'docker rm -f "$container" >/dev/null' EXIT
for attempt in $(seq 1 30); do
  if docker exec "$container" node -e "const r=await fetch('http://127.0.0.1:3000/api/health/live'); process.exit(r.status===200?0:1)" 2>/dev/null; then break; fi
  sleep 1
done
docker exec -i "$container" node --input-type=module - <<'JS'
for (const [path,status] of [['/api/health/live',200],['/api/health/ready',503],['/api/domain-check',401],['/api/internal/deployment-probe',401],['/frida-logo.svg',200]]) {
  const response=await fetch('http://127.0.0.1:3000'+path,{redirect:'manual',signal:AbortSignal.timeout(5000)});
  if(response.status!==status)throw new Error(path+' returned '+response.status);
}
JS
