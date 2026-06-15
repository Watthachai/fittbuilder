# Graph Report - fitt-builder-v2  (2026-06-15)

## Corpus Check
- 40 files · ~24,028 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 139 nodes · 233 edges · 21 communities
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `194cb11b`
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

## God Nodes (most connected - your core abstractions)
1. `rateLimit()` - 11 edges
2. `clientIp()` - 11 edges
3. `POST()` - 8 edges
4. `runProject()` - 7 edges
5. `MissingApiKeyError` - 7 edges
6. `POST()` - 6 edges
7. `POST()` - 6 edges
8. `getContainer()` - 6 edges
9. `saveProject()` - 6 edges
10. `createProject()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `rateLimit()`  [INFERRED]
  app/api/agent/route.ts → lib/rate-limit.ts
- `POST()` --calls--> `clientIp()`  [INFERRED]
  app/api/agent/route.ts → lib/rate-limit.ts
- `POST()` --calls--> `getAgent()`  [INFERRED]
  app/api/generate/route.ts → lib/agents/registry.ts
- `share()` --calls--> `encodeShareUrl()`  [INFERRED]
  components/studio/TopBar.tsx → lib/share.ts
- `launch()` --calls--> `createProject()`  [INFERRED]
  components/landing/LaunchPad.tsx → lib/storage.ts

## Communities (21 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (17): POST(), POST(), POST(), POST(), buildSpecContext(), truncateDoc(), generateText(), MissingApiKeyError (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (12): POST(), getAgent(), getAgentForPhase(), loadAgent(), parseFrontmatter(), agentSlugForPhase(), isBuildPhase(), nextPhase() (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.22
Nodes (14): launch(), launchInterview(), launchSpec(), isPhaseId(), createProject(), deleteProject(), duplicateProject(), getProject() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.16
Nodes (11): docOnlyFiles(), docsFromFiles(), hasRunnableApp(), streamAgent(), streamGenerate(), streamInterview(), appendMessage(), newMessage() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (9): toFileSystemTree(), applyChanges(), BrowserUnsupportedError, getContainer(), isPreviewSupported(), pipeToTerminal(), runProject(), warmBoot() (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.27
Nodes (8): compress(), decodeShareFragment(), decompress(), encodeShareUrl(), fromBase64Url(), toBase64Url(), downloadZip(), share()

### Community 6 - "Community 6"
Cohesion: 0.38
Nodes (5): GenerationParseError, isSafePath(), mergeFiles(), normalizePath(), parseGeneration()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isBuildPhase()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Why does `decodeShareFragment()` connect `Community 5` to `Community 4`?**
  _High betweenness centrality (0.113) - this node is a cross-community bridge._
- **Why does `runProject()` connect `Community 4` to `Community 3`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `rateLimit()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`rateLimit()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `clientIp()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`clientIp()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `POST()` (e.g. with `rateLimit()` and `clientIp()`) actually correct?**
  _`POST()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13 - nodes in this community are weakly interconnected._