#!/bin/sh

set -eu

script_directory=$(CDPATH= cd "$(dirname "$0")" && pwd)
repository_root=$(CDPATH= cd "$script_directory/../.." && pwd)
pre_commit_path="$repository_root/.githooks/pre-commit"
pre_push_path="$repository_root/.githooks/pre-push"
commit_msg_path="$repository_root/.githooks/commit-msg"
test_directory=$(mktemp -d "${TMPDIR:-/tmp}/zteam-githooks.XXXXXX")

trap 'rm -rf "$test_directory"' 0 HUP INT TERM

for hook in "$pre_commit_path" "$pre_push_path" "$commit_msg_path"; do
    if [ ! -x "$hook" ]; then
        printf 'Expected an executable hook at %s\n' "$hook" >&2
        exit 1
    fi
done

(
    cd "$test_directory"
    git init -q
    git config user.name "Git hook test"
    git config user.email "git-hook-test@example.invalid"
    git checkout -q -b main

    printf 'branch guard\n' > branch-guard.txt
    git add branch-guard.txt

    if "$pre_commit_path"; then
        printf 'Expected the pre-commit hook to reject a commit on main\n' >&2
        exit 1
    fi

    git switch -q -c feat/hook-test
    "$pre_commit_path"

    printf 'docs: validate git hooks\n' > commit-message.txt
    "$commit_msg_path" commit-message.txt
    printf 'not a conventional commit\n' > commit-message.txt
    if "$commit_msg_path" commit-message.txt; then
        printf 'Expected the commit-msg hook to reject a non-conventional subject\n' >&2
        exit 1
    fi

    git commit -q -m "docs: validate git hooks"
    head_sha=$(git rev-parse HEAD)

    printf 'refs/heads/feat/hook-test %s refs/heads/feat/hook-test 0000000000000000000000000000000000000000\n' "$head_sha" |
        "$pre_push_path"

    if printf 'refs/heads/feat/hook-test %s refs/heads/main 0000000000000000000000000000000000000000\n' "$head_sha" |
        "$pre_push_path"; then
        printf 'Expected the pre-push hook to reject a push to main\n' >&2
        exit 1
    fi

    printf 'ZTEAM_HOST=127.0.0.1\n' > .env
    git add .env
    if "$pre_commit_path"; then
        printf 'Expected the hook to reject a staged .env file\n' >&2
        exit 1
    fi
    git rm --cached -q .env
    rm .env

    printf 'ZTEAM_HOST=127.0.0.1\n' > .env.example
    git add .env.example
    "$pre_commit_path"
    git rm --cached -q .env.example
    rm .env.example

    dd if=/dev/zero of=tiny-model.onnx bs=1024 count=1 2>/dev/null
    git add tiny-model.onnx
    if "$pre_commit_path"; then
        printf 'Expected the hook to reject a model weight\n' >&2
        exit 1
    fi
    git rm --cached -q tiny-model.onnx
    rm tiny-model.onnx

    dd if=/dev/zero of=too-large.bin bs=1048576 count=6 2>/dev/null
    git add too-large.bin
    if "$pre_commit_path"; then
        printf 'Expected the hook to reject a staged 6 MiB file\n' >&2
        exit 1
    fi
)

printf 'Git branch, size, secret and commit-message hook self-test passed.\n'
