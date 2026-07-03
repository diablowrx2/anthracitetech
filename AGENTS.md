# Anthracite Tech Co. — Agent Guidelines

## Pre-Task Verification Workflow

Before spawning a task to implement a feature, **always verify that the feature (or a variant) does not already exist**. Many tasks have been created unnecessarily because an agent failed to search the codebase first.

### Step 1: Run `audit-html-filesystem.js` (when replicating across files)

When a task involves adding a feature to **multiple** or **other** files (e.g. "add date filtering to other analytics dashboards"), first audit the directory to see which files exist, what categories they belong to, and which ones already have the feature.

```bash
# From the service directory
cd service

# Full audit of all HTML files, categorized by feature
node scripts/audit-html-filesystem.js .

# Machine-readable JSON output
node scripts/audit-html-filesystem.js . --json

# Show only analytics dashboards
node scripts/audit-html-filesystem.js . --category analytics-dashboard

# Show analytics dashboards that are MISSING date-range filtering
node scripts/audit-html-filesystem.js . --category analytics-dashboard --missing-feature dateRangeFilter

# Show all files that have booking forms
node scripts/audit-html-filesystem.js . --has-feature bookingForm
```

### Step 2: Run `codebase-search.js`

The `service/scripts/codebase-search.js` tool provides fast, targeted searches across HTML, JS, CSS, and JSON files.

```bash
# From the service directory
cd service

# Search for a localStorage key (catches both direct usage and const declarations)
node scripts/codebase-search.js --localstorage anthracitetech_job_summary_date_filter

# Search for a function name
node scripts/codebase-search.js --function applyDateFilter

# Search for a CSS class
node scripts/codebase-search.js --class date-filter

# Search for an element ID
node scripts/codebase-search.js --id techFilterBar

# Search for a predefined feature
node scripts/codebase-search.js --feature localStorage-persistence
node scripts/codebase-search.js --feature date-filter
node scripts/codebase-search.js --feature tech-filter

# Generic regex pattern
node scripts/codebase-search.js --pattern "getItem\\s*\\("

# Machine-readable JSON output
node scripts/codebase-search.js --feature localStorage-persistence --json

# List all predefined features
node scripts/codebase-search.js --list-features
```

### Step 3: Interpret Results

- **If matches are found**: The feature likely already exists. Open the matched file(s) and inspect the surrounding code to confirm completeness. Do **not** create a duplicate implementation.
- **If no matches are found**: Proceed with implementation, but consider whether the feature uses an existing pattern (e.g., the same localStorage naming convention as `anthracitetech_job_summary_date_filter`).

### Step 4: Grep Fallback

If `codebase-search.js` does not cover your specific need, use `grep` as a fallback:

```bash
# Search for localStorage key definitions (including const declarations)
grep -rn "anthracitetech_job_summary" service/

# Search for function definitions
grep -rn "function applyDateFilter" service/

# Search for CSS class usage
grep -rn "date-filter" service/
```

## Common Patterns to Check

Based on past lesson history, always verify these patterns before implementing:

| Feature | Search Command |
|---------|----------------|
| Date-range filter | `node scripts/codebase-search.js --feature date-filter` |
| Tech filter | `node scripts/codebase-search.js --feature tech-filter` |
| localStorage persistence | `node scripts/codebase-search.js --feature localStorage-persistence` |
| Booking form | `node scripts/codebase-search.js --feature booking-form` |
| API endpoint | `node scripts/codebase-search.js --feature api-endpoint` |
| Schema.org markup | `node scripts/codebase-search.js --feature schema-org` |

When replicating a pattern **across multiple files**, use the audit tool first to ensure no eligible files are missed:

```bash
# Example: find all analytics dashboards missing date-range filtering
node scripts/audit-html-filesystem.js . --category analytics-dashboard --missing-feature dateRangeFilter

# Example: find all files that already use localStorage
node scripts/audit-html-filesystem.js . --has-feature localStorage
```

## File Structure

- `service/` — Frontend HTML pages, client JS, CSS, build scripts
- `service/scripts/` — Build, validation, audit, and search tools

## Coding Conventions

- **localStorage keys**: Use `snake_case` with an `anthracitetech_` prefix, e.g., `anthracitetech_job_summary_date_filter`
- **Function names**: Use `camelCase` for JS functions
- **CSS classes**: Use `kebab-case` for CSS classes
- **Element IDs**: Use `camelCase` for element IDs

## Prevention Rules (from validated lessons)

- **Rule 013**: Always verify existing form functionality before assuming what needs to be built. Test complete data flow from form submission through backend storage before making implementation assumptions.
- **Pattern 022**: Verify existing form functionality before assuming what needs to be built — many forms have UI but lack proper data handling.
- **Pattern 011-015**: Use multi-layered verification that checks filesystem presence, permissions, dependencies, and actual functionality.
