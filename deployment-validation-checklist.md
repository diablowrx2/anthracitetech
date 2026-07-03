# Deployment Validation Checklist

> Validation happens automatically on deploy

---

## PREVENTION STEPS

Follow these patterns to avoid known pitfalls.

### Multi-Layered Verification
*[pattern-011-012-013-015] — Checks filesystem presence, permissions, dependencies, and actual functionality*

- [ ] **Step 1:** Add filesystem search  
  ```bash
  find /usr /home -name 'hermes' -type f -executable 2>/dev/null
  ```
- [ ] **Step 2:** Verify dependencies  
  ```bash
  hermes --check-deps
  ```
  (validates config files and credentials)
- [ ] **Step 3:** Test actual functionality  
  ```bash
  hermes --dry-run simple-task
  ```
  (verifies end-to-end pipeline)

### External Diagnostic Capabilities
*[pattern-003-006-007-008-009] — Health checks that operate independently of the main execution environment*

- [ ] **Step 1:** Create external health monitor  
  ```bash
  systemctl --user enable hermes-health-check.timer
  ```
- [ ] **Step 2:** Implement diagnostic mode with minimal dependencies  
  ```bash
  hermes --diagnostic-mode --no-agents
  ```
- [ ] **Step 3:** Add external logging endpoint  
  ```bash
  curl -X POST localhost:8080/health
  ```
  (bypasses agent execution)

### Complete Data Flow Testing
*[pattern-022] — Test from form submission through backend storage before making implementation assumptions*

- [ ] **Step 1:** Submit test form data and verify database entry  
  ```sql
  SELECT * FROM form_submissions ORDER BY created_at DESC LIMIT 1;
  ```
- [ ] **Step 2:** Check network requests  
  Open DevTools → Network tab during form submission to verify API calls.
- [ ] **Step 3:** Test error handling  
  Submit invalid data to confirm proper validation and error display.

### Pre-Flight Static Pattern Verification
*[pattern-PRE-FLIGHT] — Grep-based queries to detect anti-patterns, leaked credentials, debug artifacts, and stale refs*

### Pre-Flight Schema Pattern Inference
*[pattern-PRE-FLIGHT-SCHEMA] — Before editing location pages in a multi-part task, infer the canonical schema pattern and remaining scope automatically*

- [ ] **Step 1:** Run pre-flight schema check to discover canonical pattern  
  ```bash
  npm run preflight:schemas
  ```
  (reads all existing location pages, extracts JSON-LD, identifies the most complete page as reference)
- [ ] **Step 2:** Scope work for current part (e.g., Part 3/3)  
  ```bash
  npm run preflight:schemas -- --part 3 --of 3
  ```
  (auto-calculates which gaps belong to this part — no clarifying questions needed)
- [ ] **Step 3:** Validate after modifications  
  ```bash
  npm run validate:schemas
  ```
  (confirms all schemas pass Schema.org and Google Rich Results requirements)

### Pre-Flight Static Pattern Verification
*[pattern-PRE-FLIGHT] — Grep-based queries to detect anti-patterns, leaked credentials, debug artifacts, and stale refs*

- [ ] **Step 1:** Scrub for debug & console noise  
  ```bash
  grep -rnE '(console\.(log|warn|debug)|debugger|TODO|FIXME|HACK)' --include='*.js' --include='*.ts' src/
  ```
- [ ] **Step 2:** Hunt for hardcoded secrets & tokens  
  ```bash
  grep -rnE '(api[_-]?key|password|secret|token)\s*=\s*["\'][^"\']{8,}' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.yaml' src/ config/
  ```
- [ ] **Step 3:** Verify critical imports & exports are present  
  ```bash
  grep -rnE '^(import|export)\s+' --include='*.js' --include='*.ts' src/ | grep -v '\.test\.' | wc -l
  grep -rn 'from\s+["\']\.\.\/\.\.\/' --include='*.js' --include='*.ts' src/
  ```
- [ ] **Step 4:** Check for stale agent/config references  
  ```bash
  grep -rn 'hermes' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.sh' . | grep -v 'node_modules' | grep -v '\.git'
  ```
