---
description: Feature Development Workflow (Multi-Agent)
---

This workflow guides the end-to-end process of implementing a new feature or fixing a bug using a multi-agent approach.

### 1. Version Control Setup
// turbo
1. Check current git branch. If on `main` or `master`, create and switch to a new descriptive branch: `git checkout -b feature/requirement-name`.
2. Ensure the working directory is clean.

### 2. Architecture & Design (Role: Architect)
> **Note:** If this task is a **defect or bug fix**, you may skip this step and proceed directly to **Step 3 (Implementation)** unless the fix requires a significant structural change.

1. Analyze the requirements or the defect report thoroughly.
2. Define the architectural approach (for features) or Root Cause Analysis (for complex bugs), including:
    - Component structure and data flow.
    - Integration points.
    - Impact assessment on existing systems.
3. Establish best practices and design patterns specifically for this implementation.
4. Document the plan in a temporary research file if the complexity warrants it.

### 3. Implementation (Role: Senior Software Engineer)
1. Implement the feature according to the architect's design.
2. Follow the established best practices.
3. Ensure the code is clean, readable, and properly modularized.
4. Verify basic functionality as you develop.

### 4. Quality Assurance (Role: QA Architect)
1. Review the implemented changes.
2. Evaluate the implementation against the architectural design and best practices.
3. Perform exploratory testing and edge-case analysis.
4. Identify any defects, inconsistencies, or architectural violations.
5. If defects are found, return to step 3 for the Senior SE to address them.

### 5. Automation & Regression (Role: Automation Engineer)
1. Run all existing automated tests to ensure no regressions were introduced.
2. Create new automated tests (unit, integration, or e2e) covering the new functionality.
3. Ensure all tests pass with high confidence.
// turbo
4. Run the pre-commit verification script: `./scripts/pre-commit.sh`.
5. **If tests or build fail:**
    - **Step Id: Fix failures**: Analyze the error output.
    - Fix the code or update the tests as needed.
    - Re-run `./scripts/pre-commit.sh` until it passes.

### 6. Completion & Submission
1. Review the final state of the code.
// turbo
2. Add all changes: `git add .`
// turbo
3. Commit with a descriptive message using conventional commit prefixes (e.g., `feat: ...` for features or `fix: ...` for bug fixes).
// turbo
4. Push the branch to the remote repository.
5. Open a Pull Request via the browser or CLI.

### Recent Implementations
- **Find/Replace Feature**: Successfully implemented with ReDoS protection, file size limits, proper error handling, frontend UI components, and Node.js backend endpoints. Pre-commit quality gates verified.
