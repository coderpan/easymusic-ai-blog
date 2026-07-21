#!/bin/sh
set -eu

remote="${AUTOMATION_REMOTE:-origin}"
branch="${AUTOMATION_BASE_BRANCH:-main}"
current_repo="$(pwd -P)"
current_commit="$(git rev-parse HEAD)"
repo_url="$(git remote get-url "$remote")"
repo_name="$(basename "$current_repo")"
tmp_dir="${TMPDIR:-/tmp}/automation-publish-${repo_name}-$$"

cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "automation-publish-current: working tree has uncommitted changes; commit first." >&2
  exit 1
fi

run_checks() {
  if [ "$#" -gt 0 ]; then
    "$@"
    return
  fi

  if node -e 'const s=require("./package.json").scripts||{}; process.exit(s.validate ? 0 : 1)' >/dev/null 2>&1; then
    npm run validate
  else
    npm run check
    npm run build
  fi
}

echo "automation-publish-current: cloning latest $remote/$branch into $tmp_dir"
git clone "$repo_url" "$tmp_dir"

echo "automation-publish-current: importing current commit $current_commit"
git -C "$tmp_dir" fetch "$current_repo" "$current_commit"
if ! git -C "$tmp_dir" cherry-pick FETCH_HEAD; then
  git -C "$tmp_dir" cherry-pick --abort >/dev/null 2>&1 || true
  echo "automation-publish-current: cherry-pick failed; resolve on a fresh branch manually." >&2
  exit 1
fi

(
  cd "$tmp_dir"
  run_checks "$@"
)

echo "automation-publish-current: refreshing $remote/$branch before push"
git -C "$tmp_dir" fetch "$remote" "$branch" --prune
if ! git -C "$tmp_dir" merge-base --is-ancestor "$remote/$branch" HEAD; then
  git -C "$tmp_dir" rebase "$remote/$branch"
  (
    cd "$tmp_dir"
    run_checks "$@"
  )
fi

if ! git -C "$tmp_dir" push "$remote" "HEAD:$branch"; then
  echo "automation-publish-current: first push rejected; retrying after fetch/rebase." >&2
  git -C "$tmp_dir" fetch "$remote" "$branch" --prune
  git -C "$tmp_dir" rebase "$remote/$branch"
  (
    cd "$tmp_dir"
    run_checks "$@"
  )
  git -C "$tmp_dir" push "$remote" "HEAD:$branch"
fi

echo "automation-publish-current: published $(git -C "$tmp_dir" rev-parse HEAD) to $remote/$branch"
