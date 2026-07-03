# Prevention Playbook: How to Dodge the Usual Pitfalls 🛡️

> Hey there! These are the lessons we've learned the hard way so you don't have to. Follow these steps and you'll save yourself (and the team) a ton of headaches down the road.

---

## 🔍 Keep an Eye on Things from the Outside

**The patterns:** 003, 006, 007, 008, 009  
**The gist:** Make sure you've got health checks that work *even when* the main system is having a rough day. Think of it as a smoke detector that runs on its own battery!

- [ ] **Step 1 — Set up that health monitor**  
  Just run this and you're good:
  ```bash
  systemctl --user enable hermes-health-check.timer
  ```

- [ ] **Step 2 — Try diagnostic mode (agents off!)**  
  Super handy for when you want to check things without all the extra stuff running:
  ```bash
  hermes --diagnostic-mode --no-agents
  ```

- [ ] **Step 3 — Add a direct health ping**  
  This one skips the agents entirely — nice and simple:
  ```bash
  curl -X POST localhost:8080/health
  ```

---

## 📬 Test Your Data Flow Before You Call It Done

**The pattern:** 022  
**The gist:** Don't just *assume* your forms are working. Actually follow the data from the user's click all the way to the database. Trust, but verify!

- [ ] **Step 1 — Send some test data and peek at the DB**  
  ```sql
  SELECT * FROM form_submissions ORDER BY created_at DESC LIMIT 1;
  ```
  *Did your test submission show up? Great!*

- [ ] **Step 2 — Watch the network traffic**  
  Pop open DevTools → Network tab, submit a form, and make sure those API calls are actually firing.

- [ ] **Step 3 — Try to break it on purpose**  
  Submit some bad data. Does the form catch it? Does it show a helpful error? If yes, you're golden! 🎉

---

## 🧪 Make Sure Your Tests Actually Test Something

**The patterns:** 001, 002, 004  
**The gist:** A test that passes isn't worth much if it only checks that a handler ran — not that the work got done. Verify real outcomes, not just dispatch.

- [ ] **Step 1 — Assert the actual work happened**  
  Don't just check that the handler returned OK:
  ```python
  assert handler_result.actual_work_completed == True
  ```
  *Make sure the side effects you care about actually occurred.*

- [ ] **Step 2 — Run end-to-end pipeline tests**  
  ```bash
  pytest tests/integration/test_full_pipeline.py
  ```
  *These validate real outputs across the whole flow, not just individual units.*

- [ ] **Step 3 — Flag stub handlers so they don't sneak into prod**  
  Use a visible decorator or marker:
  ```python
  @stub_handler
  def my_handler():
      pass
  ```
  *This makes it obvious what's still a placeholder before deploy.*

---

## 🧪 Double-Check Everything (Like, Everything)

**The patterns:** 011, 012, 013, 015  
**The gist:** Files there? Permissions right? Dependencies happy? Actually works? Check all four and sleep better tonight.

- [ ] **Step 1 — Hunt down those executables**  
  ```bash
  find /usr /home -name 'hermes' -type f -executable 2>/dev/null
  ```

- [ ] **Step 2 — Make sure all your ducks are in a row**  
  ```bash
  hermes --check-deps
  ```
  *This'll make sure your configs and credentials are all squared away.*

- [ ] **Step 3 — Run a safe test drive**  
  ```bash
  hermes --dry-run simple-task
  ```
  *It's like a rehearsal — the whole pipeline runs, but nothing actually goes live.*

---

## 🔎 Grep Your Way to Safety (Pre-Flight)

**The pattern:** PRE-FLIGHT  
**The gist:** Before you ship, grep the codebase for known stinkers — debug code, hardcoded secrets, stale TODOs, and conflicting imports. It's the fastest bug prevention you'll ever do.

- [ ] **Step 1 — Scrub for debug & console noise**  
  ```bash
  grep -rnE '(console\.(log|warn|debug)|debugger|TODO|FIXME|HACK)' --include='*.js' --include='*.ts' src/
  ```
  *Clean these up or promote them to tracked issues before deploy.*

- [ ] **Step 2 — Hunt for hardcoded secrets & tokens**  
  ```bash
  grep -rnE '(api[_-]?key|password|secret|token)\s*=\s*["\'][^"\']{8,}' --include='*.js' --include='*.ts' --include='*.json' --include='*.yml' --include='*.yaml' src/ config/
  ```
  *If something looks like a credential, rotate it and move it to env vars.*

- [ ] **Step 3 — Verify critical imports & exports are present**  
  ```bash
  grep -rnE '^(import|export)\s+' --include='*.js' --include='*.ts' src/ | grep -v '\.test\.' | wc -l
  grep -rn 'from\s+["\']\.\.\/\.\.\/' --include='*.js' --include='*.ts' src/
  ```
  *Zero imports in a module? Suspicious. Deep relative path `../../` spam? Refactor candidate.*

- [ ] **Step 4 — Check for stale agent/config references**  
  ```bash
  grep -rn 'hermes' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.sh' . | grep -v 'node_modules' | grep -v '\.git'
  ```
  *Make sure config paths and agent names match what's actually deployed.*

---

## Quick Sanity Check ✅

Before you ship it, make sure you've ticked these off:

- [ ] Health checks are running independently
- [ ] You followed a form submission all the way through
- [ ] Integration tests actually verify real work got done
- [ ] All four layers of verification passed
- [ ] Pre-flight grep checks came back clean (no debug noise, secrets, or stale refs)

**Pro tip:** When in doubt, run the dry-run test one more time. It takes 30 seconds and could save you hours of debugging later. You've got this! 💪
