# Cleanup Rules

Standards for performing safe cleanup and refactoring tasks.

---

## Overview

Cleanup work improves code quality without changing functionality. These rules ensure cleanup is safe, reversible, and well-documented.

---

## Cleanup Execution Files

### Required Documentation

Before any cleanup effort, create a tracking file:

```
CLEANUP_EXECUTION_YYYY-MM-DD.md
```

**Location**: Project root

**Purpose**: Document what will be cleaned, why, and track progress

### Execution File Template

```markdown
# Cleanup Execution - YYYY-MM-DD

## Scope
Brief description of cleanup goals.

## Files Affected
- [ ] `path/to/file1.ts` - Reason for change
- [ ] `path/to/file2.ts` - Reason for change

## Backup Location
`_cleanup_backup_YYYY-MM-DD/`

## Changes Made
| File | Change | Status | Reversible |
|------|--------|--------|------------|
| | | | |

## Verification
- [ ] Application builds
- [ ] Tests pass
- [ ] Manual verification complete

## Rollback Plan
Steps to reverse changes if needed.

## Completion
- Started: YYYY-MM-DD HH:MM
- Completed: YYYY-MM-DD HH:MM
- Verified by: [name]
```

---

## Cleanup Goals

### Primary Objectives

- **Improve clarity**: Make code easier to understand
- **Reduce redundancy**: Remove duplicate code
- **Enhance organization**: Better file/folder structure
- **Update dependencies**: Remove unused, update outdated
- **Fix inconsistencies**: Align with coding standards

### What Cleanup Is NOT

- Feature development
- Bug fixes (unless trivially related)
- Performance optimization
- Architecture changes

---

## Safety Rules

### Soft Deletions Only

**All file removals must be soft deletions:**

```bash
# Correct - move to backup
mv src/old-file.ts _cleanup_backup_YYYY-MM-DD/old-file.ts

# WRONG - permanent deletion
rm src/old-file.ts
```

### Backup Requirements

Before modifying any file:

1. Create backup directory: `_cleanup_backup_YYYY-MM-DD/`
2. Copy original file to backup
3. Preserve directory structure in backup
4. Document in execution file

### Backup Structure

```
_cleanup_backup_YYYY-MM-DD/
├── src/
│   ├── components/
│   │   └── OldComponent.tsx
│   └── utils/
│       └── deprecated-util.ts
└── manifest.json  # List of all backed up files
```

### Manifest File

```json
{
  "created": "2024-01-15T10:30:00Z",
  "reason": "Quarterly cleanup - remove deprecated components",
  "files": [
    {
      "original": "src/components/OldComponent.tsx",
      "backup": "_cleanup_backup_2024-01-15/src/components/OldComponent.tsx",
      "action": "removed",
      "reason": "Replaced by NewComponent"
    }
  ]
}
```

---

## Reversibility

### Every Change Must Be Reversible

- Keep backups for minimum 30 days
- Document how to restore each change
- Test rollback procedure before cleanup
- Never delete backups until verified stable

### Rollback Procedure

1. Stop deployment pipeline
2. Restore files from backup
3. Run tests to verify
4. Deploy restored version
5. Investigate what went wrong

---

## Behavior Preservation

### No Functional Changes

Cleanup must not change application behavior:

- Same inputs produce same outputs
- Same user interactions produce same results
- Same API calls return same responses
- Same errors occur under same conditions

### Verification Requirements

After cleanup:

- [ ] All existing tests pass
- [ ] Application builds without errors
- [ ] Manual smoke test of affected areas
- [ ] No new console warnings or errors

---

## Types of Cleanup

### Code Cleanup

- Remove unused imports
- Remove unused variables
- Remove commented-out code
- Fix linting warnings
- Standardize formatting

### File Cleanup

- Remove unused files
- Consolidate duplicate files
- Reorganize file structure
- Update import paths

### Dependency Cleanup

- Remove unused packages
- Update outdated packages (minor versions only)
- Consolidate duplicate dependencies
- Audit security vulnerabilities

### Documentation Cleanup

- Remove outdated documentation
- Update inaccurate comments
- Add missing documentation
- Standardize documentation format

---

## Prohibited Practices

### Never Do

- **Hard-delete files** without backup
- **Refactor without backups** of originals
- **Mix cleanup with features** in same PR
- **Make untracked changes** not in execution file
- **Skip verification** steps
- **Delete backups** before stability confirmed
- **Change behavior** during cleanup
- **Rush cleanup** to meet deadlines

### Always Do

- Create execution file first
- Back up before modifying
- Document every change
- Verify after each step
- Keep cleanup PRs focused
- Review cleanup like any other code

---

## Cleanup Workflow

### Phase 1: Planning

1. Identify cleanup targets
2. Create execution file
3. Estimate scope and time
4. Get approval if significant

### Phase 2: Preparation

1. Create backup directory
2. Back up all target files
3. Create manifest
4. Verify backups are complete

### Phase 3: Execution

1. Make changes incrementally
2. Update execution file as you go
3. Run tests after each significant change
4. Commit frequently with clear messages

### Phase 4: Verification

1. Run full test suite
2. Build application
3. Manual smoke test
4. Review all changes

### Phase 5: Completion

1. Update execution file with completion status
2. Create PR with cleanup changes
3. Get code review
4. Merge and monitor
5. Schedule backup deletion (30+ days)

---

## Git Practices

### Commit Messages

```
cleanup: remove unused UserProfile component

- Backed up to _cleanup_backup_2024-01-15/
- Component replaced by ProfileCard in v2.0
- No references found in codebase
```

### Branch Naming

```
cleanup/YYYY-MM-DD-description
cleanup/2024-01-15-remove-deprecated-components
```

### PR Guidelines

- Title: `Cleanup: [brief description]`
- Link to execution file
- List all removed/modified files
- Confirm backup location
- Confirm tests pass

---

## Scheduling

### When to Do Cleanup

- After major feature releases
- During low-activity periods
- As part of regular maintenance
- When technical debt impacts velocity

### When NOT to Do Cleanup

- During active feature development
- Before major releases
- When team is understaffed
- Without proper time allocation

---

## Checklist

Before starting cleanup:

- [ ] Execution file created
- [ ] Scope clearly defined
- [ ] Backup directory created
- [ ] All target files backed up
- [ ] Manifest file created
- [ ] Tests passing before changes

After completing cleanup:

- [ ] All changes documented
- [ ] Tests still passing
- [ ] Application builds
- [ ] Manual verification done
- [ ] Execution file updated
- [ ] PR created and reviewed
- [ ] Backup retention scheduled

---

*Cleanup is maintenance, not heroics. Take your time and do it safely.*
