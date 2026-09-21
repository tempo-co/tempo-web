#!/usr/bin/env bash
set -euo pipefail

workflow_file=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/.github/workflows/staging-deploy.yml
python3 - "$workflow_file" <<'PY'
import sys
import yaml

workflow = open(sys.argv[1], encoding='utf-8').read()
parsed = yaml.safe_load(workflow)
assert parsed['permissions']['actions'] == 'read'
assert parsed['jobs']['build']['permissions'] == {'contents': 'read'}
assert parsed['jobs']['publish']['permissions']['packages'] == 'write'
required = [
    'workflow_dispatch:',
    'pr_number:',
    'runs-on: ubuntu-latest',
    'gh api "repos/$repo/pulls/$pr"',
    '[[ "$GITHUB_REF" == refs/heads/main ]]',
    '[[ "$head_repo" == "$repo" ]]',
    'platforms: linux/amd64',
    'gh api --paginate',
    '--jq',
    'trusted_workflow_id=',
    'trusted_run_json',
    'max_by(.id)',
    '.status',
    '.conclusion',
    'actions/runs?head_sha=',
    'contents/.github/workflows/ci.yml?ref=',
    'check_suite.id',
    'actions: read',
    'pull-requests: read',
    'statuses: read',
    'head_sha',
    'check-runs',
    'missing_checks=',
    'Lint & Format',
    'E2E Tests',
    'docker/build-push-action@',
    'load: true',
    'upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    'download-artifact@37930b1c2abaa49bbe596cd826c3c89aef350131',
    'Publish web image',
    'outputs:',
    'digest: ${{ steps.digest.outputs.digest }}',
    'tailscale/github-action@780049a30b6ff5c378a9e7b389d15ece7a204888',
    'STAGING_TAILSCALE_OAUTH_CLIENT_ID',
    'STAGING_SSH_PRIVATE_KEY',
    'STAGING_SSH_KNOWN_HOSTS',
    'tempo-staging-ssh-deploy deploy web',
    'IMAGE_DIGEST: ${{ needs.publish.outputs.digest }}',
    'VITE_API_URL=/staging/api',
    'VITE_BASE_PATH=/staging/',
    'NGINX_CONFIG=tempo-staging.conf',
    'persist-credentials: false',
    'Run staging path contracts',
    'Install web dependencies',
    'CHECK_STAGING_BUILD=1',
    'Probe staging mount redirects',
    'docker port',
    'staging asset redirect dropped mount prefix',
]
for fragment in required:
    assert fragment in workflow, fragment
contract_checkout = workflow.split('Checkout staging contracts', 1)[1].split('Run staging path contracts', 1)[0]
assert 'ref: ${{ steps.pr.outputs.head_sha }}' in contract_checkout
assert 'persist-credentials: false' in contract_checkout
assert 'self-hosted' not in workflow
assert ':latest' not in workflow
assert 'pull_request:' not in workflow
print('tempo web staging workflow contract: PASS')
PY
