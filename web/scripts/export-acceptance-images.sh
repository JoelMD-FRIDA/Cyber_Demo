#!/usr/bin/env bash
# Temporary private-acceptance artifact; never an automatic deployment release.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_ENVIRONMENT:-}" != github-hosted ||
      "${GITHUB_REPOSITORY:-}" != 'JoelMD-FRIDA/Cyber_Demo' || "${GITHUB_EVENT_NAME:-}" != pull_request ]]; then
  echo 'Export acceptance images only from this repository on GitHub-hosted PR checks.' >&2
  exit 1
fi
[[ "$(git rev-parse HEAD)" == "${FRIDA_REVIEW_COMMIT:?Missing reviewed commit}" ]]
postgres='postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c'
docker pull --platform linux/amd64 "$postgres"
docker tag "$postgres" frida-acceptance-postgres:18.6-reviewed
mkdir -p .bootstrap-images
# Bound archive output; no environment/config/data is exported.
(ulimit -f 524288; docker image save 'frida-domain-app-test' 'frida-domain-tools-test' frida-acceptance-postgres:18.6-reviewed | gzip -1 > .bootstrap-images/images.tar.gz)
export FRIDA_BOOTSTRAP_ID='frida-domain-check' FRIDA_BOOTSTRAP_APP='frida-domain-app-test' FRIDA_BOOTSTRAP_TOOLS='frida-domain-tools-test'
python3 - <<'MANIFEST'
import hashlib,json,os,subprocess
from pathlib import Path
e=os.environ
images={}
for key,tag in [('app',e['FRIDA_BOOTSTRAP_APP']),('tools',e['FRIDA_BOOTSTRAP_TOOLS']),('database','frida-acceptance-postgres:18.6-reviewed')]:
    image=json.loads(subprocess.check_output(['docker','image','inspect',tag]))[0]
    assert image['Os']=='linux' and image['Architecture']=='amd64'
    images[key]={'tag':tag,'id':image['Id'],'layers':image['RootFS']['Layers']}
path=Path('.bootstrap-images/images.tar.gz')
with path.open('rb') as stream:sha=hashlib.file_digest(stream,'sha256').hexdigest()
manifest={'schema':1,'purpose':'private-acceptance-only','automatic_deployment_eligible':False,
          'id':e['FRIDA_BOOTSTRAP_ID'],'repository':e['GITHUB_REPOSITORY'],
          'commit':e['FRIDA_REVIEW_COMMIT'],'run_id':int(e['GITHUB_RUN_ID']),
          'run_attempt':int(e['GITHUB_RUN_ATTEMPT']),'runner_environment':e['RUNNER_ENVIRONMENT'],
          'database_source':'postgres:18-bookworm@sha256:afc7e2d441324c0388fa80c3d24f733b4194a4eb7f47dd8ee2b08eb1a24a647c',
          'archive_sha256':sha,'archive_bytes':path.stat().st_size,'images':images}
Path('.bootstrap-images/manifest.json').write_text(json.dumps(manifest,sort_keys=True,indent=2)+'\n')
print('Acceptance images prepared; automatic publication/deployment remain disabled.')
MANIFEST
