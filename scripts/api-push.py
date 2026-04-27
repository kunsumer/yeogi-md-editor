#!/usr/bin/env python3
"""
Squash-pushes the current working tree to kunsumer/yeogi-md-editor via GitHub's
Git Data API, bypassing the raw-git-port block on this network. Creates one
commit per invocation containing every tracked file at its current working-tree
state. Commit history is not preserved (the firewall-bypass case is one-shot
by design — local history stays on the feature branch).

Usage:
    python3 scripts/api-push.py              # use commit message from HEAD
    python3 scripts/api-push.py <sha-or-ref> # use commit message from that ref

The second form is useful when you want to squash several local commits but
keep the message of a specific one (typically the release commit, not the
follow-up Cargo.lock bump).
"""
import base64
import subprocess
import sys
import requests
import warnings
warnings.filterwarnings("ignore")

REPO = "kunsumer/yeogi-md-editor"
BRANCH = "main"
API = "https://api.github.com"

# Commit message source: defaults to HEAD so the usual "push what I just
# committed" case requires no args. Pass a SHA / ref as argv[1] to pick a
# different commit's message (useful for pre-release when HEAD is a lockfile
# bump and the real release message lives one commit back).
MSG_REF = sys.argv[1] if len(sys.argv) > 1 else "HEAD"


def sh(cmd):
    return subprocess.check_output(cmd, shell=True).decode().strip()


token = sh("gh auth token")
session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
})


def api_post(path, body):
    r = session.post(f"{API}{path}", json=body)
    if not r.ok:
        print(f"POST {path} -> {r.status_code} {r.text[:500]}", file=sys.stderr)
        r.raise_for_status()
    return r.json()


def api_get(path):
    r = session.get(f"{API}{path}")
    if not r.ok:
        # 404 = doesn't exist; 409 on git/* paths = repo is empty. Both mean
        # "nothing there yet" — return None and let the caller bootstrap.
        if r.status_code in (404, 409):
            return None
        print(f"GET {path} -> {r.status_code} {r.text[:500]}", file=sys.stderr)
        r.raise_for_status()
    return r.json()


# List every tracked file with its mode so we preserve executables.
raw = sh("git ls-files -s")
entries = []
for line in raw.splitlines():
    meta, path = line.split("\t", 1)
    mode, _sha, _stage = meta.split(" ")
    entries.append({"path": path, "mode": mode})

# Bootstrap empty repo: Git Data API returns 409 on empty repos, so use
# Contents API first to create an initial blob and get a base ref. `default_branch`
# in repo metadata can be "main" even before any commits exist, so we gate
# the bootstrap on the presence of an actual HEAD ref.
head_ref = api_get(f"/repos/{REPO}/git/refs/heads/{BRANCH}")
if not head_ref:
    print("Bootstrapping empty repo…", flush=True)
    r = session.put(f"{API}/repos/{REPO}/contents/.gitkeep", json={
        "message": "bootstrap",
        "content": base64.b64encode(b"").decode("ascii"),
        "branch": BRANCH,
    })
    if not r.ok:
        print(f"bootstrap failed: {r.status_code} {r.text[:500]}", file=sys.stderr)
        r.raise_for_status()

print(f"Uploading {len(entries)} files as blobs…", flush=True)
tree_nodes = []
for i, e in enumerate(entries, 1):
    with open(e["path"], "rb") as f:
        data = f.read()
    blob = api_post(f"/repos/{REPO}/git/blobs", {
        "content": base64.b64encode(data).decode("ascii"),
        "encoding": "base64",
    })
    tree_nodes.append({
        "path": e["path"],
        "mode": e["mode"],
        "type": "blob",
        "sha": blob["sha"],
    })
    if i % 20 == 0 or i == len(entries):
        print(f"  {i}/{len(entries)}", flush=True)

print("Creating tree…", flush=True)
tree = api_post(f"/repos/{REPO}/git/trees", {"tree": tree_nodes})
print(f"  tree sha {tree['sha'][:12]}")

msg = sh(f"git log -1 --pretty=%B {MSG_REF}")
author_name = sh(f"git log -1 --pretty=%an {MSG_REF}")
author_email = sh(f"git log -1 --pretty=%ae {MSG_REF}")
print(f"Using commit message from {MSG_REF}")

print("Creating commit…", flush=True)
commit = api_post(f"/repos/{REPO}/git/commits", {
    "message": msg,
    "tree": tree["sha"],
    "author": {"name": author_name, "email": author_email},
})
print(f"  commit sha {commit['sha'][:12]}")

ref_path = f"/repos/{REPO}/git/refs/heads/{BRANCH}"
existing = api_get(ref_path)
if existing:
    print(f"Updating existing ref {BRANCH}…", flush=True)
    r = session.patch(f"{API}{ref_path}", json={
        "sha": commit["sha"],
        "force": True,
    })
    r.raise_for_status()
else:
    print(f"Creating ref {BRANCH}…", flush=True)
    api_post(f"/repos/{REPO}/git/refs", {
        "ref": f"refs/heads/{BRANCH}",
        "sha": commit["sha"],
    })

# Set the default branch in case it hasn't been yet.
session.patch(f"{API}/repos/{REPO}", json={"default_branch": BRANCH})

print(f"\nDone. HEAD now at https://github.com/{REPO}/commit/{commit['sha']}")
