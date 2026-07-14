# Graph Report - fitt-builder-v2  (2026-07-14)

## Corpus Check
- 238 files · ~339,364 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1159 nodes · 1924 edges · 106 communities (103 shown, 3 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 193 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a0c575f9`
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
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]

## God Nodes (most connected - your core abstractions)
1. `rateLimit()` - 34 edges
2. `clientIp()` - 30 edges
3. `createAdminClient()` - 23 edges
4. `currentUserId()` - 22 edges
5. `createClient()` - 18 edges
6. `POST()` - 16 edges
7. `getAdminUser()` - 16 edges
8. `MissingApiKeyError` - 16 edges
9. `generateText()` - 15 edges
10. `APISecurityTester` - 14 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `requestOrigin()`  [INFERRED]
  app/auth/callback/route.ts → lib/origin.ts
- `AdminUsagePage()` --calls--> `createAdminClient()`  [INFERRED]
  app/admin/usage/page.tsx → lib/supabase/admin.ts
- `AdminSkillsPage()` --calls--> `getAdminUser()`  [INFERRED]
  app/admin/skills/page.tsx → lib/admin-server.ts
- `POST()` --calls--> `getAdminUser()`  [INFERRED]
  app/api/admin/generate-skill/route.ts → lib/admin-server.ts
- `GET()` --calls--> `getAdminUser()`  [INFERRED]
  app/api/skills/route.ts → lib/admin-server.ts

## Communities (106 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (59): POST(), POST(), POST(), stripFences(), POST(), stripFence(), POST(), POST() (+51 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (37): accept(), openOrgDna(), fileToAttachment(), acceptMyInvite(), listMyInvites(), appendDnaBlock(), archetypeMeta(), createOrg() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.1
Nodes (23): isChangelogUnseen(), latestVersion(), createOrgInvite(), listOrgInvites(), listOrgMembers(), removeOrgMember(), revokeOrgInvite(), token() (+15 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (18): onSystemLog(), deleteMessage(), groupReactions(), loadMessages(), rowToMessage(), sendMessage(), sendSystemMessage(), toggleReaction() (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (10): AWSAuditor, AzureAuditor, GCPAuditor, main(), print_summary(), Audit GCP project for common misconfigurations using gcloud CLI., Audit Azure subscription for common misconfigurations using az CLI., Run a CLI command and return parsed JSON output or raw text. (+2 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (25): toFileSystemTree(), idbGet(), idbSet(), openDb(), applyChanges(), BrowserUnsupportedError, cacheNodeModules(), cleanNodeModules() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (21): deleteOrgSkill(), getOrgSkill(), orgSkillSlug(), saveOrgSkill(), compress(), decodeShareFragment(), decompress(), encodeShareUrl() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.1
Nodes (13): POST(), DELETE(), PATCH(), isAdminEmail(), getAdminUser(), estimateCostUsd(), GET(), bodyToRow() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.13
Nodes (17): AnomalyDetector, _generate_sample_events(), main(), mean(), print_summary(), Detect time-windowed event spikes compared to rolling average., Flag user activity outside business hours., Flag sources that appear very rarely (potential new/external actors). (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (21): fetchApprovalRoster(), createInvite(), disableShareLink(), getShareToken(), listInvites(), listMembers(), removeMember(), renewShareLink() (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (13): APISecurityTester, main(), print_summary(), Test for Broken Object Level Authorization by incrementing object IDs., Test for endpoints accessible without authentication., Test for mass assignment vulnerabilities., Test for missing rate limiting on sensitive endpoints., Check for missing security headers. (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.14
Nodes (13): EvidenceCollector, main(), Collect filesystem evidence (recently modified files, suspicious paths)., Collect network configuration and active connections., Collect key log files., Generate chain of custody entry for an evidence file., Save evidence data to file and return the path., Calculate SHA-256 hash of a file. (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.14
Nodes (20): projectToRow(), rowToProject(), isPhaseId(), appendMessage(), approvePhase(), deleteProject(), getAccess(), listProjects() (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.13
Nodes (12): main(), Detect web server from headers., Detect CMS from response body and headers., Detect JavaScript frameworks and backend frameworks., Detect Web Application Firewalls., Detect CDN providers., Detect analytics and tracking tools., Analyze security-related HTTP headers. (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (12): main(), Attempt zone transfer (AXFR) on nameservers., Resolve a single subdomain to IP address(es)., Test a single subdomain candidate., Brute-force subdomain enumeration using a wordlist., Detect wildcard DNS resolution., Resolve all discovered subdomains to IPs., Execute full enumeration pipeline. (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (11): DependencyAuditor, main(), Query OSV database for vulnerabilities., Extract severity from vulnerability data., Audit a list of packages for vulnerabilities., Extract fixed versions from vulnerability data., Run full audit on a project directory., Scans project dependencies against vulnerability databases. (+3 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (15): docOnlyFiles(), docsFromFiles(), hasRunnableApp(), buildFittcorePayload(), buildFittcoreSpec(), downloadFittcoreSpec(), fittcoreBodyPreview(), promptsOf() (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (10): main(), Calculate overall and section-level entropy., Extract and categorize strings., Detect known packers and protectors., Generate Indicators of Compromise., Execute full static analysis., Static malware analysis engine., Calculate multiple hash types. (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (10): BinaryAnalyzer, main(), Extract ASCII and Unicode strings from binary., Check if string looks like an IP address., Check ELF security features., Execute full binary analysis., Static binary analysis engine for ELF and PE files., Identify binary type from magic bytes. (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (11): main(), Classify event severity based on content., Process all log files in a directory., Build a chronological timeline from all collected events., Export timeline to CSV., Export timeline to JSON., Export timeline as HTML report., Build forensic timelines from multiple log sources. (+3 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (9): designStyleDirective(), fetchDesignOptions(), captureDnaFromText(), baseDeps(), extraDepsOf(), packageJsonWithDeps(), streamAgent(), streamGenerate() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.15
Nodes (10): LogParser, main(), Parse JSON-formatted logs (one JSON per line)., Parse logs matching a regex pattern., Parse unstructured logs., Classify a log event into security categories., Generate summary statistics from parsed events., Security log parsing and normalization engine. (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (9): _load_sample_alerts(), main(), Generate a Markdown shift handover report., Generate a structured JSON report., Return sample alerts for demo/testing purposes., Generate SOC shift handover reports from alert data., Load alerts from a JSON file., Compute summary statistics from loaded alerts. (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (10): DNSRecon, main(), Parse SPF record into components., Parse DMARC record into components., Perform reverse DNS lookups., Execute full DNS reconnaissance., Comprehensive DNS reconnaissance engine., Enumerate all DNS record types. (+2 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (10): main(), Check which TLS/SSL protocols are supported., Get cipher suite information., Check for security-related HTTP headers (if HTTPS web server)., Assess vulnerabilities based on audit results., Calculate overall TLS grade (A-F)., TLS/SSL configuration auditing engine., Perform full TLS audit. (+2 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (9): main(), PCAPAnalyzer, Detect beaconing patterns (regular interval callbacks)., Detect port scanning activity., Execute full PCAP analysis., Network traffic analysis engine for PCAP files., Calculate protocol distribution statistics., Identify top source and destination IPs by volume. (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (9): IOCExtractor, main(), Check if IP is in a private/reserved range., Filter out likely false positive hashes., Defang network indicators for safe sharing., Convert results to CSV format., Convert results to STIX 2.1 bundle format., Extract and categorize IOCs from text input. (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (8): remove(), confirm(), duplicateProject(), getProject(), handleDelete(), handleDuplicate(), handleShare(), onFocus()

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (5): applyTheme(), choose(), useDismiss(), useTheme(), Overlay()

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (5): LinuxHardeningChecker, main(), Validate kernel network/exec hardening sysctls (CIS-aligned)., Flag risky/legacy filesystem & network modules that should be disabled., Check Linux system hardening against CIS-style benchmarks.

### Community 30 - "Community 30"
Cohesion: 0.19
Nodes (8): main(), PayloadGenerator, Generate web shell payloads., Generate XSS testing payloads., Generate SQL injection testing payloads., Print available payload types., Security testing payload generation engine., Generate reverse shell payloads.

### Community 31 - "Community 31"
Cohesion: 0.23
Nodes (8): GET(), POST(), buildInvitePayload(), buildOrgInvitePayload(), sendOrgInviteEmail(), sendProjectInviteEmail(), requestOrigin(), POST()

### Community 32 - "Community 32"
Cohesion: 0.24
Nodes (10): getAgent(), getAgentForPhase(), loadAgent(), parseFrontmatter(), agentSlugForPhase(), nextPhase(), phaseDef(), phaseIndex() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.23
Nodes (7): main(), Generate a YARA rule from a single sample., Generate YARA rules from all samples in a directory., YARA rule generation engine from malware samples., Extract unique and meaningful strings from binary data., Extract unique hex byte patterns from binary., YaraGenerator

### Community 34 - "Community 34"
Cohesion: 0.23
Nodes (7): main(), MITREMapper, MITRE ATT&CK technique mapping and query generation engine., Look up a technique by ID., Map multiple technique IDs to ATT&CK details., Generate a SIEM detection query for a technique., Generate an ATT&CK Navigator layer JSON.

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (7): IaCScanner, main(), Scan a Terraform file for security issues., Scan a Dockerfile for security issues., Scan Kubernetes manifests for security issues., Scan a directory of IaC files., Infrastructure as Code security scanner.

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (5): buildFileTree(), closeTab(), openFile(), remove(), submitCreate()

### Community 37 - "Community 37"
Cohesion: 0.26
Nodes (11): calculate_base_score(), get_severity(), interactive_mode(), main(), parse_vector(), print_report(), CVSS round-up function (always round up to 1 decimal)., Guide user through interactive CVSS metric selection. (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.23
Nodes (10): capContent(), computeChanges(), deriveProductName(), GenerationParseError, isSafePath(), mergeFiles(), normalizePath(), parseGeneration() (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (6): AlertTriager, main(), Generate recommended triage actions., Triage a batch of alerts., Automated SOC alert triage engine., Classify and prioritize a single alert.

### Community 40 - "Community 40"
Cohesion: 0.35
Nodes (8): createWithSkill(), launch(), launchInterview(), launchSpec(), KEY(), setPendingAction(), takePendingAction(), createProject()

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (7): emit(), settleDialog(), subscribeDialog(), onKeyDown(), accept(), cancel(), onKey()

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (3): main(), OWASPScanner, Basic OWASP Top 10 web vulnerability scanner.

### Community 43 - "Community 43"
Cohesion: 0.28
Nodes (3): applyGenerated(), generate(), streamGenerateSkill()

### Community 44 - "Community 44"
Cohesion: 0.31
Nodes (6): beginGeneration(), emit(), endGeneration(), getActiveGenerations(), isGenerating(), subscribeGenerations()

### Community 45 - "Community 45"
Cohesion: 0.5
Nodes (6): add(), dismiss(), emit(), scheduleAutoDismiss(), subscribeToasts(), update()

### Community 46 - "Community 46"
Cohesion: 0.48
Nodes (6): analyze(), main(), manifest_from_zip(), Fallback: pull printable strings out of the binary manifest., scan_secrets(), try_pyaxml()

### Community 47 - "Community 47"
Cohesion: 0.52
Nodes (6): heatmap(), load(), main(), num(), score_risk(), severity()

### Community 48 - "Community 48"
Cohesion: 0.38
Nodes (4): ConfigAuditor, main(), Configuration security auditor for various services., Run all security checks against the configuration file.

### Community 49 - "Community 49"
Cohesion: 0.52
Nodes (4): AgentStreamFilter, isDocKind(), parseAsk(), parseCite()

### Community 50 - "Community 50"
Cohesion: 0.6
Nodes (5): analyze_pcap(), emit_dorks(), first(), get_layers(), main()

### Community 51 - "Community 51"
Cohesion: 0.6
Nodes (5): dotted_get(), judge(), load_lines(), main(), send()

### Community 52 - "Community 52"
Cohesion: 0.53
Nodes (5): iter_paths(), main(), Return list of dangerous findings from a pickle byte stream., scan_file(), scan_pickle_bytes()

### Community 53 - "Community 53"
Cohesion: 0.47
Nodes (3): streamChat(), buildContext(), send()

### Community 55 - "Community 55"
Cohesion: 0.6
Nodes (3): findHighlightRanges(), normalizeWithMap(), normFragment()

### Community 58 - "Community 58"
Cohesion: 0.83
Nodes (3): generate_plan(), main(), to_markdown()

## Knowledge Gaps
- **168 isolated node(s):** `YARA rule generation engine from malware samples.`, `Extract unique and meaningful strings from binary data.`, `Extract unique hex byte patterns from binary.`, `Generate a YARA rule from a single sample.`, `Generate YARA rules from all samples in a directory.` (+163 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `Community 2` to `Community 1`, `Community 3`, `Community 6`, `Community 9`, `Community 12`, `Community 16`, `Community 20`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `confirm()` connect `Community 27` to `Community 1`, `Community 2`, `Community 36`, `Community 6`, `Community 41`, `Community 20`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `isBuildPhase()` connect `Community 0` to `Community 32`, `Community 16`, `Community 3`, `Community 20`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `rateLimit()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`rateLimit()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `clientIp()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`clientIp()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `createAdminClient()` (e.g. with `joinProject()` and `AdminUsagePage()`) actually correct?**
  _`createAdminClient()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `currentUserId()` (e.g. with `POST()` and `POST()`) actually correct?**
  _`currentUserId()` has 10 INFERRED edges - model-reasoned connections that need verification._