# Project-First Host Model Discussion Summary

## Why This Exists

We started from the multi-host / VM / SSH work around making remote servers,
VMs, SSH targets, and future Orca cloud compute feel first class.

The first implementation direction made hosts visible as the outermost sidebar
sections:

```text
Local Mac
  Orca
    feature-a

openclaw 2
  Orca
    feature-b
```

That is useful for operational awareness, but it changes the mental model from
"I am working on a project" to "I am inside a machine." After brainstorming, the
preferred durable model is project-first:

```text
Orca
  Local Mac
    feature-a
  openclaw 2
    feature-b
```

In plain English: a host is a place where a project can run. A host should not
usually be the object that owns the user's project.

## Current Product Decision

Move Orca toward:

```text
Project -> ProjectHostSetup -> Workspace
```

Where:

- `Project` is the durable repo/project identity the user recognizes.
- `Host` is a local Mac, SSH target, remote runtime, VM, remote server, or
  future Orca cloud VM.
- `ProjectHostSetup` means "this project is available on this host at this path
  with this setup state and host-specific configuration."
- `Workspace` is a branch/task/worktree running from one project setup on one
  host.

This means the same project can exist on one host, many hosts, or only a remote
host. A project that only works on Linux, a GPU VM, a work machine, or a remote
server is not an edge case. It is a normal project with limited host
availability.

## What We Learned From References

### Superset

Superset is the closer reference for Orca's desired data model.

Its model is effectively:

```text
Project + Host -> Workspace
```

The important lessons for Orca:

- Project identity is durable.
- A host is where the project can be materialized.
- Workspace creation targets both project and host.
- A project can be set up on multiple hosts.
- If a project is not set up on a host, the UI can block and offer setup.
- Project settings can contain host-specific location/worktree settings.

This maps well to Orca because Orca already has durable repos/projects,
worktrees, agents, terminals, source control, and host-aware runtimes.

### Cmux

Cmux is more session/workspace-first.

Its model is closer to:

```text
Workspace/session -> local or remote execution context
```

The useful lessons from Cmux are about SSH polish:

- remote terminals feel first class
- file and browser views follow the remote execution context
- remote localhost behavior matters
- reconnect/persistence behavior matters

Cmux is less useful as the core data model reference because it does not appear
to center "this project is available on these hosts" as the durable user object.

## UX Direction

### Sidebar

The default long-term sidebar should be project-first.

For simple single-host projects, avoid noisy host nesting:

```text
Orca
  feature-a
  feature-b
```

For mixed-host projects, show host context inline or as subgroups:

```text
Orca
  Local Mac
    feature-a
  GPU VM
    benchmark-runner
```

The host-first sidebar remains useful as an operational view or filter. It is
good for seeing what is online, what is disconnected, and where work is
running. It should not be the only durable mental model.

### Create Workspace

Workspace creation should eventually ask:

1. Which project?
2. Which host should run it?
3. What branch/task/workspace name?

If the project is not set up on the selected host, the flow should offer:

- clone project to that host
- import an existing folder on that host
- select a different host

### Project Setup

Adding a project and making a project available on a host are separate actions.

Important flows:

- import a local folder as a new project
- import an SSH folder as a new project
- set up an existing project on another host
- clone a project onto a selected host
- when adding a new VM/host, optionally initialize one or more projects there
- later, provision an Orca cloud VM and materialize a selected project there

### Settings

Settings need explicit ownership:

- client settings belong to the desktop client
- host settings belong to a machine/runtime
- project settings belong to the durable project
- project-host setup settings belong to that project on that host

A host dropdown or table inside project settings is probably enough for
host-specific project settings, similar to the existing Windows/WSL split.

Examples:

- global project name/icon/provider linkage: project setting
- path to checkout: project-host setup setting
- worktree base path on `openclaw 2`: project-host setup setting
- SSH connection details: host setting
- desktop theme or local UI preferences: client setting

## What Needs To Change

There are 12 major change surfaces to fully fit this new model.

### 1. Shared Data Model

`Repo` currently mixes durable project identity with host-local setup details.
The new model needs first-class `Project`, `Host`, and `ProjectHostSetup`
concepts.

Needed:

- durable project identity
- host-specific setup records
- explicit workspace ownership by `projectId`, `hostId`, and
  `projectHostSetupId`
- compatibility projection from the old repo-shaped world

Current branch status: partially implemented.

### 2. Persistence And Migration

Existing users need a boring migration.

Needed:

- derive one project per reliable durable identity
- derive one setup per existing repo checkout
- avoid merging same-name folders unless provider/setup identity is reliable
- preserve old ids or aliases where compatibility requires it
- backfill existing workspaces with project/setup ownership when safe

Current branch status: partially implemented.

### 3. Runtime And Request Ownership

The UI may be project-first, but execution still happens on a host.

Needed:

- route terminals, agents, filesystem, browser, source control, hooks, and
  automations through the workspace's owning host
- scope cancellation and stale-response handling to host/setup ownership
- avoid using the currently focused host as a hidden global default for
  workspace-owned operations

Current branch status: partially implemented by the multi-host groundwork, but
needs a project/setup audit.

### 4. Workspace Creation

Workspace creation must target a project and host, not only a repo id.

Needed:

- project picker
- run-on host picker
- unavailable-host reasons
- inline clone/import setup actions
- compatibility resolver to map `{ projectId, hostId }` onto current backend
  repo/setup paths while old APIs remain

Current branch status: partially implemented at the resolver/model layer; UI is
not complete.

### 5. Project Setup Flow

"Add repo" becomes a family of project/setup flows.

Needed:

- import existing folder on local host
- import existing folder over SSH
- clone project onto selected host
- set up an existing project on another host
- bulk setup when adding a new host
- future cloud provisioning hook

Current branch status: existing-folder API is partially implemented; clone,
bulk setup, and full UI are not complete.

### 6. Sidebar Row Model

The sidebar needs to be built from projects, hosts, setups, and workspaces.

Needed:

- project-first grouping
- host labels/subgroups only when useful
- host filters and online/offline status retained
- clear disconnected-host behavior
- drag/reorder rules for projects, host sections, and workspaces

Current branch status: host-first work exists and project/setup data is
available; long-term project-first row model is not complete.

### 7. Project Settings

Project settings need a global area plus host-specific setup sections.

Needed:

- project-global settings
- host-specific paths, worktree paths, setup scripts, and platform constraints
- host dropdown/table inside settings
- provider-neutral source-control settings

Current branch status: not complete.

### 8. Host Settings

Host settings should describe the machine/runtime, not duplicate every project
setting.

Needed:

- connection details
- display name
- health/status
- server version and protocol compatibility
- platform/capabilities
- host-wide defaults and overrides

Current branch status: multi-host branch has host settings groundwork; needs to
fit cleanly with project-host setup settings.

### 9. Version And Capability Compatibility

New clients and old servers will coexist.

Needed:

- host capability probing
- fallback projection when project/setup APIs are missing
- disabled states with specific reasons
- structured errors for unsupported old-server actions
- old client / new server behavior that degrades safely

Current branch status: multi-host protocol compatibility exists; project/setup
capabilities need to be layered onto it.

### 10. Caches And Local State

Some caches are project-global; many are host/setup-local.

Needed:

- classify caches as project, host, setup, or workspace scoped
- include host/setup ids in cache keys for refs, git status, filesystem state,
  capabilities, terminals, browser sessions, and remote results
- prevent a response from one host from overwriting another host's state

Current branch status: partially addressed for host partitioning; needs a
project/setup ownership audit.

### 11. CLI And API

External commands should speak the project-first language.

Needed:

- `orca project list`
- `orca project setup ...`
- `orca project hosts ...`
- `orca workspace create --project <id> --host <id> ...`
- compatibility aliases for old repo/worktree commands
- structured availability errors

Current branch status: runtime/local APIs are partially implemented; CLI is not
complete.

### 12. Tests And Verification

This crosses storage, routing, UI, SSH, and compatibility.

Needed:

- migration tests
- selector/sidebar grouping tests
- create-workspace tests
- setup-on-host tests
- settings ownership tests
- SSH end-to-end validation
- version mismatch tests
- Electron validation for sidebar, creation, and settings

Current branch status: many model/API tests exist; end-to-end UI and SSH
coverage for the final model remains.

## Short Answer On Count

The clean answer is: 12 major things need to change.

Some are already partially done in this branch, especially the additive
`Project` / `ProjectHostSetup` model, compatibility projection, initial runtime
RPC/local APIs, workspace metadata stamping, and existing-folder setup API.

The biggest remaining product-shaping pieces are:

1. project-first workspace creation UI
2. setup project on host UI
3. project settings with host-specific setup panes
4. sidebar model moving from host-first default to project-first default
5. cache/request ownership audit
6. CLI/API completion
7. full SSH, Electron, and version-skew validation

## Migration Principle

This should be an additive migration.

Keep old repo/worktree APIs working while adding project/setup APIs. Local-only
users should mostly see the same Orca they already know. Users with SSH
machines, VMs, remote servers, and future cloud hosts should gain a clearer
answer to: "Which project am I working on, and where is this workspace running?"

