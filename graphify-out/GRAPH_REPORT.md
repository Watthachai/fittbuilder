# Graph Report - fitt-builder-v2  (2026-06-18)

## Corpus Check
- 49 files · ~40,178 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 203 nodes · 349 edges · 24 communities
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `078f3abe`
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

## God Nodes (most connected - your core abstractions)
1. `rateLimit()` - 17 edges
2. `clientIp()` - 17 edges
3. `getContainer()` - 10 edges
4. `execRun()` - 10 edges
5. `MissingApiKeyError` - 9 edges
6. `POST()` - 8 edges
7. `runProject()` - 7 edges
8. `generateText()` - 7 edges
9. `POST()` - 6 edges
10. `POST()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `getPreset()`  [INFERRED]
  app/api/extract-answers/route.ts → lib/presets.ts
- `POST()` --calls--> `rateLimit()`  [INFERRED]
  app/api/agent/route.ts → lib/rate-limit.ts
- `POST()` --calls--> `clientIp()`  [INFERRED]
  app/api/agent/route.ts → lib/rate-limit.ts
- `POST()` --calls--> `rateLimit()`  [INFERRED]
  app/api/generate/route.ts → lib/rate-limit.ts
- `POST()` --calls--> `clientIp()`  [INFERRED]
  app/api/generate/route.ts → lib/rate-limit.ts

## Communities (24 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (24): toFileSystemTree(), idbGet(), idbSet(), openDb(), applyChanges(), BrowserUnsupportedError, cacheNodeModules(), cleanNodeModules() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (14): POST(), POST(), stripFences(), POST(), POST(), POST(), generateText(), MissingApiKeyError (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (16): docOnlyFiles(), docsFromFiles(), hasRunnableApp(), GenerationParseError, isSafePath(), mergeFiles(), normalizePath(), parseGeneration() (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (11): POST(), buildSpecContext(), truncateDoc(), getPreset(), buildGenerationSystemPrompt(), buildIterationSystemPrompt(), buildIterationUserPrompt(), baseDeps() (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (14): POST(), getAgent(), getAgentForPhase(), loadAgent(), parseFrontmatter(), agentSlugForPhase(), isBuildPhase(), nextPhase() (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.2
Nodes (14): launch(), launchInterview(), launchSpec(), isPhaseId(), createProject(), deleteProject(), duplicateProject(), getProject() (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (5): buildFileTree(), closeTab(), openFile(), remove(), submitCreate()

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (8): compress(), decodeShareFragment(), decompress(), encodeShareUrl(), fromBase64Url(), toBase64Url(), downloadZip(), share()

### Community 8 - "Community 8"
Cohesion: 0.47
Nodes (3): streamChat(), buildContext(), send()

### Community 9 - "Community 9"
Cohesion: 0.53
Nodes (3): AgentStreamFilter, isDocKind(), parseAsk()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `isBuildPhase()` connect `Community 4` to `Community 2`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `decodeShareFragment()` connect `Community 7` to `Community 0`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `rateLimit()` connect `Community 1` to `Community 3`, `Community 4`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `rateLimit()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`rateLimit()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `clientIp()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`clientIp()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._