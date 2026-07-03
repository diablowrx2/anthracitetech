# Operational Prevention Protocols

> **Policy Objective:** Mitigate known operational risks through standardized procedural safeguards. Adherence to the following protocols is required prior to system deployment.

---

## I. External Diagnostic & Health Monitoring

**Reference Patterns:** 003, 006, 007, 008, 009  
**Objective:** Establish autonomous diagnostic capabilities that function independently of the primary execution environment to ensure continuous operational visibility.

| Step | Action | Command / Procedure |
|------|--------|---------------------|
| 1 | **Enable External Health Monitoring** | `systemctl --user enable hermes-health-check.timer` |
| 2 | **Implement Minimal-Dependency Diagnostic Mode** | `hermes --diagnostic-mode --no-agents` |
| 3 | **Configure Independent Logging Endpoint** | `curl -X POST localhost:8080/health` |

> **Note:** The logging endpoint above is designed to bypass agent execution entirely, thereby ensuring diagnostic integrity regardless of agent state.

---

## II. End-to-End Data Flow Validation

**Reference Pattern:** 022  
**Objective:** Verify complete data transmission integrity from client-facing form submission through to backend persistence. Assumptions regarding implementation fidelity must not supersede empirical validation.

| Step | Action | Command / Procedure |
|------|--------|---------------------|
| 1 | **Validate Database Persistence** | `SELECT * FROM form_submissions ORDER BY created_at DESC LIMIT 1;` |
| 2 | **Audit Network Transactions** | Open DevTools → Network tab during form submission to verify API calls. |
| 3 | **Confirm Error Handling Compliance** | Submit intentionally invalid data to verify validation logic and user-facing error presentation. |

---

## III. Functional Integration Test Verification

**Reference Patterns:** 001, 002, 004  
**Objective:** Ensure integration tests validate concrete functional outcomes rather than merely confirming handler dispatch or superficial success signals.

| Step | Action | Command / Procedure |
|------|--------|---------------------|
| 1 | **Assert Actual Work Completion** | `assert handler_result.actual_work_completed == True` |
| 2 | **Execute End-to-End Pipeline Validation** | `pytest tests/integration/test_full_pipeline.py` |
| 3 | **Explicitly Flag Stub Handlers** | Apply `@stub_handler` decorator to placeholder handlers to prevent production deployment |

> **Note:** Step 1 shifts verification from dispatch confirmation to outcome validation. Step 3 establishes a clear visual/policy signal for incomplete implementations.

---

## IV. Multi-Layered System Verification

**Reference Patterns:** 011, 012, 013, 015  
**Objective:** Conduct comprehensive verification across four critical dimensions: filesystem presence, access permissions, dependency chain integrity, and functional operability.

| Step | Action | Command / Procedure |
|------|--------|---------------------|
| 1 | **Verify Filesystem Presence** | `find /usr /home -name 'hermes' -type f -executable 2>/dev/null` |
| 2 | **Validate Dependency Integrity** | `hermes --check-deps` |
| 3 | **Execute Functional Dry-Run** | `hermes --dry-run simple-task` |

> **Note:** Step 2 confirms the validity of configuration files and stored credentials. Step 3 provides end-to-end pipeline verification without production impact.

---

## V. Pre-Flight Static Pattern Verification

**Reference Pattern:** PRE-FLIGHT  
**Objective:** Execute targeted grep-based queries to detect known anti-patterns, leaked credentials, debug artifacts, stale configuration references, and structural anomalies prior to deployment.

| Step | Action | Command / Procedure |
|------|--------|---------------------|
| 1 | **Detect Debug Artifacts & Ad-hoc Markers** | `grep -rnE '(console\.(log\|warn\|debug)\|debugger\|TODO\|FIXME\|HACK)' --include='*.js' --include='*.ts' src/` |
| 2 | **Identify Hardcoded Secrets & Credentials** | `grep -rnE '(api[_-]?key\|password\|secret\|token)\s*=\s*["\'][^"\']{8,}' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.yaml' src/ config/` |
| 3 | **Audit Import/Export Integrity & Path Depth** | `grep -rnE '^(import\|export)\s+' --include='*.js' --include='*.ts' src/ \| grep -v '\.test\.'; grep -rn 'from\s+["\']\.\.\/\.\.\/' --include='*.js' --include='*.ts' src/` |
| 4 | **Validate Agent & Configuration References** | `grep -rn 'hermes' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.sh' . \| grep -v 'node_modules' \| grep -v '\.git'` |

> **Note:** Steps 1–3 operate on source and configuration trees only. Step 4 ensures deployed service names, agent identifiers, and orchestration paths align with the target environment manifest.

---

## Compliance Checklist

- [ ] External diagnostic capabilities are enabled and independently operational.
- [ ] Data flow has been empirically validated from submission through persistence.
- [ ] Functional integration tests verify actual outcomes, not just handler dispatch.
- [ ] Multi-layered verification has been completed with documented results.
- [ ] Pre-flight static pattern verification (grep) has been executed with no unresolved findings.

**Authorized By:** _________________________  **Date:** ___________
