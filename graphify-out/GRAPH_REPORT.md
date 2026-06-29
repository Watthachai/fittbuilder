# Graph Report - fitt-builder-v2  (2026-06-29)

## Corpus Check
- 152 files · ~98,741 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 496 nodes · 812 edges · 62 communities (61 shown, 1 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 118 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eab63934`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `rateLimit()` - 21 edges
2. `clientIp()` - 21 edges
3. `getAdminUser()` - 16 edges
4. `createAdminClient()` - 14 edges
5. `currentUserId()` - 13 edges
6. `MissingApiKeyError` - 12 edges
7. `createClient()` - 12 edges
8. `generateText()` - 11 edges
9. `POST()` - 10 edges
10. `recordUsage()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `onFocus()` --calls--> `getProject()`  [INFERRED]
  components/studio/Studio.tsx → lib/storage.ts
- `GET()` --calls--> `requestOrigin()`  [INFERRED]
  app/auth/callback/route.ts → lib/origin.ts
- `AdminSkillsPage()` --calls--> `getAdminUser()`  [INFERRED]
  app/admin/skills/page.tsx → lib/admin-server.ts
- `POST()` --calls--> `getAllSkills()`  [INFERRED]
  app/api/detect-skill/route.ts → lib/skills/db.ts
- `POST()` --calls--> `detectSkillByKeywords()`  [INFERRED]
  app/api/detect-skill/route.ts → lib/skills/registry.ts

## Communities (62 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (27): POST(), buildSpecContext(), truncateDoc(), capContent(), computeChanges(), GenerationParseError, isSafePath(), mergeFiles() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (20): POST(), POST(), POST(), stripFences(), POST(), stripFence(), POST(), POST() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (18): POST(), DELETE(), PATCH(), isAdminEmail(), getAdminUser(), estimateCostUsd(), GET(), bodyToRow() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (23): beginGeneration(), emit(), endGeneration(), getActiveGenerations(), isGenerating(), subscribeGenerations(), docOnlyFiles(), docsFromFiles() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (25): toFileSystemTree(), idbGet(), idbSet(), openDb(), applyChanges(), BrowserUnsupportedError, cacheNodeModules(), cleanNodeModules() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (19): projectToRow(), rowToProject(), isPhaseId(), approvePhase(), deleteProject(), duplicateProject(), getAccess(), getApprovalState() (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (13): isChangelogUnseen(), latestVersion(), createOrg(), ensureDefaultOrg(), getOrg(), listOrgs(), rowToOrg(), leave() (+5 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (16): emitSystemLog(), onSystemLog(), deleteMessage(), groupReactions(), loadMessages(), rowToMessage(), sendMessage(), sendSystemMessage() (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (5): applyTheme(), choose(), useDismiss(), useTheme(), Overlay()

### Community 9 - "Community 9"
Cohesion: 0.2
Nodes (16): createInvite(), disableShareLink(), getShareToken(), listInvites(), listMembers(), removeMember(), revokeInvite(), setShareLink() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (13): buildFittcoreSpec(), downloadFittcoreSpec(), slug(), compress(), decodeShareFragment(), decompress(), encodeShareUrl(), fromBase64Url() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.18
Nodes (5): buildFileTree(), closeTab(), openFile(), remove(), submitCreate()

### Community 12 - "Community 12"
Cohesion: 0.27
Nodes (9): getAgent(), getAgentForPhase(), loadAgent(), parseFrontmatter(), agentSlugForPhase(), nextPhase(), phaseDef(), phaseIndex() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.35
Nodes (8): createWithSkill(), launch(), launchInterview(), launchSpec(), KEY(), setPendingAction(), takePendingAction(), createProject()

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (5): GET(), POST(), buildInvitePayload(), sendProjectInviteEmail(), requestOrigin()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (3): useFileDrop(), onOption(), send()

### Community 16 - "Community 16"
Cohesion: 0.28
Nodes (3): applyGenerated(), generate(), streamGenerateSkill()

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (3): useSkills(), onChange(), pick()

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (6): add(), dismiss(), emit(), scheduleAutoDismiss(), subscribeToasts(), update()

### Community 19 - "Community 19"
Cohesion: 0.53
Nodes (3): AgentStreamFilter, isDocKind(), parseAsk()

### Community 20 - "Community 20"
Cohesion: 0.47
Nodes (3): streamChat(), buildContext(), send()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 6` to `Community 3`, `Community 5`, `Community 7`, `Community 8`, `Community 9`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `recordUsage()` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `isBuildPhase()` connect `Community 1` to `Community 3`, `Community 12`, `Community 15`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `rateLimit()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`rateLimit()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `clientIp()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`clientIp()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `getAdminUser()` (e.g. with `AdminUsagePage()` and `AdminSkillsPage()`) actually correct?**
  _`getAdminUser()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `createAdminClient()` (e.g. with `joinProject()` and `AdminUsagePage()`) actually correct?**
  _`createAdminClient()` has 7 INFERRED edges - model-reasoned connections that need verification._