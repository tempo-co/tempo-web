#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
dockerignore_file="${1:-${repo_root}/.dockerignore}"
if [[ ! -f "${dockerignore_file}" ]]; then
  printf 'Docker ignore file not found: %s\n' "${dockerignore_file}" >&2
  exit 2
fi

tmp_parent="${TMPDIR:-/tmp}"
test_dir="$(mktemp -d "${tmp_parent%/}/tempo-web-dockerignore.XXXXXX")"
test_id="${test_dir##*.}"
image_tag="tempo-web-dockerignore-test:local-${test_id}"
container_id=""

cleanup() {
  if [[ -n "${container_id}" ]]; then
    docker rm "${container_id}" >/dev/null 2>&1 || true
  fi
  docker image rm "${image_tag}" >/dev/null 2>&1 || true
  rm -rf -- "${test_dir}"
}
trap cleanup EXIT

cp -- "${dockerignore_file}" "${test_dir}/.dockerignore"
mkdir -p "${test_dir}/nested/deeper"
printf '%s\n' 'SYNTHETIC_ROOT=1' > "${test_dir}/.env"
printf '%s\n' 'VITE_API_URL=__SYNTHETIC_ROOT_DOTENV__' > "${test_dir}/.env.production"
printf '%s\n' 'SYNTHETIC_NESTED=1' > "${test_dir}/nested/.env"
printf '%s\n' 'VITE_API_URL=__SYNTHETIC_NESTED_DOTENV__' > "${test_dir}/nested/.env.production"
printf '%s\n' 'SYNTHETIC_DEEP_NESTED=1' > "${test_dir}/nested/deeper/.env"
printf '%s\n' 'VITE_API_URL=__SYNTHETIC_DEEP_NESTED_DOTENV__' > "${test_dir}/nested/deeper/.env.production"
printf '%s\n' 'context-control' > "${test_dir}/keep.txt"
printf '%s\n' 'FROM scratch' 'COPY . /context' 'CMD ["/not-run"]' > "${test_dir}/Dockerfile"

(
  cd "${test_dir}"
  docker build --quiet --tag "${image_tag}" --file Dockerfile . >/dev/null
)
container_id="$(docker create "${image_tag}")"
docker export "${container_id}" | tar -tf - > "${test_dir}/image-files.txt"

grep -Fxq 'context/keep.txt' "${test_dir}/image-files.txt" || {
  printf 'Docker context control file was not copied; test is inconclusive\n' >&2
  exit 1
}

if grep -E '(^|/)\.env(\.[^/]*)?$' "${test_dir}/image-files.txt"; then
  printf 'Unexpected dotenv files were copied into the Docker build context\n' >&2
  exit 1
fi

printf 'PASS: root and nested .env and .env.* files are excluded from the Docker build context\n'
