# Graph Report - fitt-builder-v2  (2026-08-21)

## Corpus Check
- 340 files · ~518,589 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1491 nodes · 2751 edges · 153 communities (146 shown, 7 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 396 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a18167f7`
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
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 86|Community 86]]

## God Nodes (most connected - your core abstractions)
1. `rateLimit()` - 46 edges
2. `clientIp()` - 42 edges
3. `print()` - 39 edges
4. `str()` - 35 edges
5. `createAdminClient()` - 29 edges
6. `currentUserId()` - 28 edges
7. `currentUser()` - 26 edges
8. `createClient()` - 24 edges
9. `generateText()` - 23 edges
10. `MissingApiKeyError` - 21 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `getAdminUser()`  [INFERRED]
  app/api/admin/generate-skill/route.ts → lib/admin-server.ts
- `createWorkspace()` --calls--> `openCreateWorkspace()`  [INFERRED]
  components/advisor/AdvisorShell.tsx → lib/workspace-modal.ts
- `GET()` --calls--> `requestOrigin()`  [INFERRED]
  app/auth/callback/route.ts → lib/origin.ts
- `AdminSkillsPage()` --calls--> `getAdminUser()`  [INFERRED]
  app/admin/skills/page.tsx → lib/admin-server.ts
- `POST()` --calls--> `currentUserId()`  [INFERRED]
  app/api/dna-capture/route.ts → lib/ai-usage.ts

## Communities (153 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (49): currentUser(), currentUserId(), watch(), createOrgInvite(), listOrgInvites(), removeOrgMember(), revokeOrgInvite(), token() (+41 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (43): brandFromOrg(), clampPercent(), acceptanceClauses(), baht(), money(), defaultAcceptance(), defaultMaintenance(), emptyBrand() (+35 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (38): createWithSkill(), launch(), launchInterview(), launchSpec(), toFileSystemTree(), idbGet(), idbSet(), openDb() (+30 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (27): POST(), POST(), stripFences(), POST(), stripFence(), POST(), POST(), POST() (+19 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (27): AnomalyDetector, _generate_sample_events(), main(), mean(), print_summary(), Detect time-windowed event spikes compared to rolling average., Flag user activity outside business hours., Flag sources that appear very rarely (potential new/external actors). (+19 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (21): deleteMessage(), downloadProjectFile(), fileUrls(), groupReactions(), listProjectFiles(), loadMessages(), rowToMessage(), sendMessage() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (20): designStyleDirective(), fetchDesignOptions(), captureDnaFromText(), isPhaseId(), appendMessage(), approvePhase(), clearDraft(), getAccess() (+12 more)

### Community 7 - "Community 7"
Cohesion: 0.14
Nodes (10): AWSAuditor, AzureAuditor, GCPAuditor, main(), print_summary(), Audit GCP project for common misconfigurations using gcloud CLI., Audit Azure subscription for common misconfigurations using az CLI., Run a CLI command and return parsed JSON output or raw text. (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (21): buildFittcorePayload(), buildFittcoreSpec(), downloadFittcoreSpec(), fittcoreBodyPreview(), promptsOf(), slug(), toBase64(), zipFiles() (+13 more)

### Community 9 - "Community 9"
Cohesion: 0.11
Nodes (16): projectToRow(), rowToProject(), trimOldDiffs(), deleteProject(), duplicateProject(), duplicateProjectAs(), getProject(), listProjects() (+8 more)

### Community 10 - "Community 10"
Cohesion: 0.13
Nodes (14): DELETE(), PATCH(), getAdminUser(), estimateCostUsd(), GET(), AdminPartnersPage(), bodyToRow(), updateToRow() (+6 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (18): buildScreenMapUser(), pageFiles(), parseScreenMap(), clearShots(), dataUrlToBlob(), decode(), deleteShot(), encode() (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (14): EvidenceCollector, main(), Collect filesystem evidence (recently modified files, suspicious paths)., Collect network configuration and active connections., Collect key log files., Generate chain of custody entry for an evidence file., Save evidence data to file and return the path., Calculate SHA-256 hash of a file. (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (13): APISecurityTester, main(), print_summary(), Test for Broken Object Level Authorization by incrementing object IDs., Test for endpoints accessible without authentication., Test for mass assignment vulnerabilities., Test for missing rate limiting on sensitive endpoints., Check for missing security headers. (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (12): main(), Attempt zone transfer (AXFR) on nameservers., Resolve a single subdomain to IP address(es)., Test a single subdomain candidate., Brute-force subdomain enumeration using a wordlist., Detect wildcard DNS resolution., Resolve all discovered subdomains to IPs., Execute full enumeration pipeline. (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (12): main(), Detect web server from headers., Detect CMS from response body and headers., Detect JavaScript frameworks and backend frameworks., Detect Web Application Firewalls., Detect CDN providers., Detect analytics and tracking tools., Analyze security-related HTTP headers. (+4 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (11): DependencyAuditor, main(), Query OSV database for vulnerabilities., Extract severity from vulnerability data., Audit a list of packages for vulnerabilities., Extract fixed versions from vulnerability data., Run full audit on a project directory., Scans project dependencies against vulnerability databases. (+3 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (16): buildWandPrompt(), parseLoc(), bgAction(), mergeClasses(), offsetOf(), openingTagEnd(), paddingAction(), patchClassName() (+8 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (10): main(), Calculate overall and section-level entropy., Extract and categorize strings., Detect known packers and protectors., Generate Indicators of Compromise., Execute full static analysis., Static malware analysis engine., Calculate multiple hash types. (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (10): BinaryAnalyzer, main(), Extract ASCII and Unicode strings from binary., Check if string looks like an IP address., Check ELF security features., Execute full binary analysis., Static binary analysis engine for ELF and PE files., Identify binary type from magic bytes. (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.14
Nodes (11): main(), Classify event severity based on content., Process all log files in a directory., Build a chronological timeline from all collected events., Export timeline to CSV., Export timeline to JSON., Export timeline as HTML report., Build forensic timelines from multiple log sources. (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (12): POST(), oversizedFiles(), buildAgentSystemPrompt(), buildGenerationSystemPrompt(), buildIterationSystemPrompt(), buildIterationUserPrompt(), renderQuestionBank(), renderSkillForBuild() (+4 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (12): remove(), createWorkspace(), removeReport(), run(), removeReport(), run(), normalizeHealthResult(), deleteAdvisorReport() (+4 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (9): _load_sample_alerts(), main(), Generate a Markdown shift handover report., Generate a structured JSON report., Return sample alerts for demo/testing purposes., Generate SOC shift handover reports from alert data., Load alerts from a JSON file., Compute summary statistics from loaded alerts. (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (10): DNSRecon, main(), Parse SPF record into components., Parse DMARC record into components., Perform reverse DNS lookups., Execute full DNS reconnaissance., Comprehensive DNS reconnaissance engine., Enumerate all DNS record types. (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.15
Nodes (10): main(), Check which TLS/SSL protocols are supported., Get cipher suite information., Check for security-related HTTP headers (if HTTPS web server)., Assess vulnerabilities based on audit results., Calculate overall TLS grade (A-F)., TLS/SSL configuration auditing engine., Perform full TLS audit. (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (10): LogParser, main(), Parse JSON-formatted logs (one JSON per line)., Parse logs matching a regex pattern., Parse unstructured logs., Classify a log event into security categories., Generate summary statistics from parsed events., Security log parsing and normalization engine. (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.19
Nodes (14): deleteOrgSkill(), getOrgSkill(), orgSkillSlug(), saveOrgSkill(), streamOrgSkill(), clearDraftStore(), discardDraft(), generate() (+6 more)

### Community 28 - "Community 28"
Cohesion: 0.15
Nodes (11): appendDnaBlock(), archetypeMeta(), clearOrgPainRadar(), coercePainRadar(), deleteOrg(), dnaCompleteness(), rowToOrg(), updateOrgDna() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (10): getOrg(), updateOrgBrand(), uploadOrgLogo(), handleCreate(), useSkills(), onChange(), pull(), push() (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (9): IOCExtractor, main(), Check if IP is in a private/reserved range., Filter out likely false positive hashes., Defang network indicators for safe sharing., Convert results to CSV format., Convert results to STIX 2.1 bundle format., Extract and categorize IOCs from text input. (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.2
Nodes (10): GET(), POST(), buildInvitePayload(), buildOrgInvitePayload(), buildPartnerLeadPayload(), sendOrgInviteEmail(), sendPartnerLeadEmail(), sendProjectInviteEmail() (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.21
Nodes (5): LinuxHardeningChecker, main(), Validate kernel network/exec hardening sysctls (CIS-aligned)., Flag risky/legacy filesystem & network modules that should be disabled., Check Linux system hardening against CIS-style benchmarks.

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (5): applyTheme(), choose(), useDismiss(), useTheme(), Overlay()

### Community 34 - "Community 34"
Cohesion: 0.19
Nodes (8): main(), PayloadGenerator, Generate web shell payloads., Generate XSS testing payloads., Generate SQL injection testing payloads., Print available payload types., Security testing payload generation engine., Generate reverse shell payloads.

### Community 35 - "Community 35"
Cohesion: 0.21
Nodes (7): POST(), getProjectOrgDnaContext(), buildOrgDnaContext(), isBuildPhase(), POST(), buildPremiumAdviceUser(), parsePremiumAdvice()

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (9): createWorkspace(), ensureDefaultOrg(), listOrgs(), openCreateWorkspace(), resolveIcon(), WorkspaceIcon(), onCreate(), create() (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.24
Nodes (10): getAgent(), getAgentForPhase(), loadAgent(), parseFrontmatter(), agentSlugForPhase(), nextPhase(), phaseDef(), phaseIndex() (+2 more)

### Community 38 - "Community 38"
Cohesion: 0.23
Nodes (7): main(), Generate a YARA rule from a single sample., Generate YARA rules from all samples in a directory., YARA rule generation engine from malware samples., Extract unique and meaningful strings from binary data., Extract unique hex byte patterns from binary., YaraGenerator

### Community 39 - "Community 39"
Cohesion: 0.23
Nodes (7): main(), MITREMapper, MITRE ATT&CK technique mapping and query generation engine., Look up a technique by ID., Map multiple technique IDs to ATT&CK details., Generate a SIEM detection query for a technique., Generate an ATT&CK Navigator layer JSON.

### Community 40 - "Community 40"
Cohesion: 0.22
Nodes (7): IaCScanner, main(), Scan a Terraform file for security issues., Scan a Dockerfile for security issues., Scan Kubernetes manifests for security issues., Scan a directory of IaC files., Infrastructure as Code security scanner.

### Community 41 - "Community 41"
Cohesion: 0.26
Nodes (12): calculate_base_score(), get_severity(), interactive_mode(), main(), parse_vector(), print_report(), CVSS round-up function (always round up to 1 decimal)., Guide user through interactive CVSS metric selection. (+4 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (5): buildFileTree(), closeTab(), openFile(), remove(), submitCreate()

### Community 43 - "Community 43"
Cohesion: 0.27
Nodes (6): POST(), detectPresetByKeywords(), getAllSkills(), listPublishedSkills(), detectSkillByKeywords(), getSkill()

### Community 44 - "Community 44"
Cohesion: 0.23
Nodes (10): capContent(), computeChanges(), deriveProductName(), GenerationParseError, isSafePath(), mergeFiles(), normalizePath(), parseGeneration() (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.25
Nodes (6): AlertTriager, main(), Generate recommended triage actions., Triage a batch of alerts., Automated SOC alert triage engine., Classify and prioritize a single alert.

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (6): POST(), buildSpecContext(), truncateBrief(), truncateDoc(), getPreset(), buildExtractAnswersSystem()

### Community 48 - "Community 48"
Cohesion: 0.27
Nodes (9): onPickFiles(), onPickFiles(), onPickFiles(), cellText(), csvEscape(), fileToAttachment(), textToBase64(), xlsxToCsvAttachment() (+1 more)

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (6): docOnlyFiles(), docsFromFiles(), hasRunnableApp(), undocumentedScreens(), gateSatisfied(), Studio()

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (8): activeVersionOf(), isVersionKey(), parkedVersions(), switchVersion(), buildPremiumContext(), premiumOptionsFor(), buildPremium(), changeVersion()

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (7): emit(), settleDialog(), subscribeDialog(), onKeyDown(), accept(), cancel(), onKey()

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (3): main(), OWASPScanner, Basic OWASP Top 10 web vulnerability scanner.

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (7): POST(), parseHealthResult(), checkGenerationQuota(), currentPrice(), currentUserId(), startOfMonthIso(), GET()

### Community 54 - "Community 54"
Cohesion: 0.27
Nodes (6): accept(), openOrgDna(), acceptMyInvite(), listMyInvites(), firstOrg(), openOrgSetup()

### Community 55 - "Community 55"
Cohesion: 0.24
Nodes (6): streamAgent(), streamChat(), streamGenerate(), streamInterview(), buildContext(), send()

### Community 56 - "Community 56"
Cohesion: 0.28
Nodes (3): applyGenerated(), generate(), streamGenerateSkill()

### Community 57 - "Community 57"
Cohesion: 0.31
Nodes (6): beginGeneration(), emit(), endGeneration(), getActiveGenerations(), isGenerating(), subscribeGenerations()

### Community 58 - "Community 58"
Cohesion: 0.39
Nodes (4): VersionWatcher(), isChangelogUnseen(), latestVersion(), GET()

### Community 59 - "Community 59"
Cohesion: 0.32
Nodes (5): ConfigAuditor, main(), Configuration security auditor for various services., Run all security checks against the configuration file., round()

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (3): sse(), POST(), parseGeneratedSkill()

### Community 61 - "Community 61"
Cohesion: 0.5
Nodes (6): add(), dismiss(), emit(), scheduleAutoDismiss(), subscribeToasts(), update()

### Community 62 - "Community 62"
Cohesion: 0.43
Nodes (6): createOrg(), emit(), resolveCreateWorkspace(), subscribeCreateWorkspace(), create(), onKey()

### Community 63 - "Community 63"
Cohesion: 0.36
Nodes (5): baseDeps(), extraDepsOf(), newPackages(), packageJsonWithDeps(), withRequiredScaffold()

### Community 64 - "Community 64"
Cohesion: 0.61
Nodes (6): buildScreenIndexPrompt(), hasScreenIndex(), screenIndexCoverage(), screenIndexEntries(), screenSources(), sourceChecklist()

### Community 65 - "Community 65"
Cohesion: 0.48
Nodes (6): analyze(), main(), manifest_from_zip(), Fallback: pull printable strings out of the binary manifest., scan_secrets(), try_pyaxml()

### Community 66 - "Community 66"
Cohesion: 0.52
Nodes (6): heatmap(), load(), main(), num(), score_risk(), severity()

### Community 68 - "Community 68"
Cohesion: 0.52
Nodes (4): AgentStreamFilter, isDocKind(), parseAsk(), parseCite()

### Community 69 - "Community 69"
Cohesion: 0.43
Nodes (3): fetchApprovalRoster(), listMembers(), getApprovalState()

### Community 70 - "Community 70"
Cohesion: 0.53
Nodes (4): marketMidpoint(), num(), parseQuoteAdvice(), str()

### Community 71 - "Community 71"
Cohesion: 0.53
Nodes (5): iter_paths(), main(), Return list of dangerous findings from a pickle byte stream., scan_file(), scan_pickle_bytes()

### Community 72 - "Community 72"
Cohesion: 0.6
Nodes (5): dotted_get(), judge(), load_lines(), main(), send()

### Community 73 - "Community 73"
Cohesion: 0.6
Nodes (5): analyze_pcap(), emit_dorks(), first(), get_layers(), main()

### Community 74 - "Community 74"
Cohesion: 0.6
Nodes (3): buildScreenSpecUser(), parseScreenSpecs(), POST()

### Community 75 - "Community 75"
Cohesion: 0.53
Nodes (4): buildMissingFilesPrompt(), candidates(), missingImports(), resolveFrom()

### Community 77 - "Community 77"
Cohesion: 0.6
Nodes (3): findHighlightRanges(), normalizeWithMap(), normFragment()

### Community 82 - "Community 82"
Cohesion: 0.83
Nodes (3): generate_plan(), main(), to_markdown()

## Knowledge Gaps
- **168 isolated node(s):** `YARA rule generation engine from malware samples.`, `Extract unique and meaningful strings from binary data.`, `Extract unique hex byte patterns from binary.`, `Generate a YARA rule from a single sample.`, `Generate YARA rules from all samples in a directory.` (+163 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `print()` connect `Community 41` to `Community 1`, `Community 4`, `Community 7`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 30`, `Community 32`, `Community 34`, `Community 38`, `Community 39`, `Community 40`, `Community 45`, `Community 52`, `Community 59`, `Community 65`, `Community 66`, `Community 71`, `Community 72`, `Community 73`, `Community 82`, `Community 86`?**
  _High betweenness centrality (0.275) - this node is a cross-community bridge._
- **Why does `str()` connect `Community 70` to `Community 1`, `Community 3`, `Community 4`, `Community 71`, `Community 40`, `Community 12`, `Community 13`, `Community 14`, `Community 15`, `Community 16`, `Community 52`, `Community 20`, `Community 24`, `Community 25`, `Community 59`, `Community 60`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `getOrg()` connect `Community 29` to `Community 1`, `Community 28`, `Community 6`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Are the 20 inferred relationships involving `rateLimit()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`rateLimit()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `clientIp()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`clientIp()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 38 inferred relationships involving `print()` (e.g. with `main()` and `main()`) actually correct?**
  _`print()` has 38 INFERRED edges - model-reasoned connections that need verification._
- **Are the 33 inferred relationships involving `str()` (e.g. with `POST()` and `.test_bola()`) actually correct?**
  _`str()` has 33 INFERRED edges - model-reasoned connections that need verification._