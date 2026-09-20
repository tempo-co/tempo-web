#!/usr/bin/env bash
set -euo pipefail

config_file=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/nginx/tempo.conf
python3 - "$config_file" <<'PY'
import sys

config = open(sys.argv[1], encoding='utf-8').read()
required = [
    'location = /tempo {',
    'location /tempo/api/ {',
    'location /tempo/ {',
    'location = /staging {',
    'location = /staging/mailpit {',
    'location /staging/mailpit/ {',
    'proxy_pass http://mailpit:8025/staging/mailpit/;',
    'location = /staging/bank-connections/callback {',
    'location = /staging/api {',
    'location /staging/api/ {',
    'location /staging/ {',
    'rewrite ^/staging/(.*)$ /$1 break;',
    'rewrite ^/staging/api/?(.*)$ /$1 break;',
]
for fragment in required:
    assert fragment in config, fragment

assert config.count('    location /tempo/ {') == 1
assert config.count('    location /staging/ {') == 1
assert 'proxy_pass http://api:3000;' in config
print('tempo web staging path contract: PASS')
PY
