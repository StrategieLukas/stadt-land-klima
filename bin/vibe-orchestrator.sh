#!/bin/bash
# vibe-orchestrator.sh - Orchestrates Mistral Vibe agents for task execution and quality review
#
# Usage: ./vibe-orchestrator.sh <task-file.md> [options]
#
# Options:
#   --checklist <file>  Use custom checklist (default: auto-generated)
#   --max-iterations N  Max feedback loops (default: 3)
#   --no-fix            Don't auto-fix, just report issues
#   --verbose           Show detailed agent interactions

set -euo pipefail

# Configuration
MAX_ITERATIONS=${MAX_ITERATIONS:-3}
VERBOSE=${VERBOSE:-false}
NO_FIX=${NO_FIX:-false}
CHECKLIST_FILE=""
TASK_FILE=""
TEMP_DIR=$(mktemp -d)
OUTPUT_DIR="${TEMP_DIR}/output"
mkdir -p "$OUTPUT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default quality checklist
generate_checklist() {
    cat << 'EOF'
# Code Quality Checklist

## General
- [ ] All changes are minimal and focused on the task
- [ ] No unrelated files were modified
- [ ] Changes follow existing code style and conventions
- [ ] No hardcoded secrets or sensitive data
- [ ] Proper error handling is in place
- [ ] Code is properly formatted (indentation, line endings)

## Documentation
- [ ] Comments explain why, not what (code should be self-documenting)
- [ ] Complex logic has inline comments
- [ ] Any breaking changes are documented

## Testing
- [ ] Existing tests still pass
- [ ] New functionality has corresponding tests
- [ ] Edge cases are handled and tested

## Security
- [ ] Input validation is present where needed
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Authentication/authorization checks are in place

## Performance
- [ ] No N+1 query problems introduced
- [ ] No unnecessary database queries
- [ ] No memory leaks in new code
- [ ] Large operations are batched/streamed where appropriate

## Frontend Specific
- [ ] Responsive design considerations
- [ ] Accessibility (a11y) best practices followed
- [ ] No console errors or warnings
- [ ] Proper loading states
- [ ] Error states are handled gracefully

## Backend Specific
- [ ] API endpoints follow REST conventions
- [ ] Proper HTTP status codes
- [ ] Rate limiting considered for public endpoints
- [ ] Database migrations are included if schema changed

## Directus Specific
- [ ] YAML files are alphabetically sorted
- [ ] Permission changes are in both public.yaml and frontend.yaml
- [ ] import-all.sh was run after schema changes
- [ ] Extensions use CSS theme variables, not hardcoded colors
EOF
}

log() {
    echo -e "${BLUE}[ORCHESTRATOR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --checklist)
            CHECKLIST_FILE="$2"
            shift 2
            ;;
        --max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --no-fix)
            NO_FIX=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        *)
            if [[ -z "$TASK_FILE" ]]; then
                TASK_FILE="$1"
                shift
            else
                echo "Unknown argument: $1"
                exit 1
            fi
            ;;
    esac
done

# Validate inputs
if [[ -z "$TASK_FILE" ]]; then
    log_error "Please provide a task file: ./vibe-orchestrator.sh <task.md>"
    exit 1
fi

if [[ ! -f "$TASK_FILE" ]]; then
    log_error "Task file not found: $TASK_FILE"
    exit 1
fi

# Resolve paths
TASK_FILE=$(realpath "$TASK_FILE")
if [[ -n "$CHECKLIST_FILE" && -f "$CHECKLIST_FILE" ]]; then
    CHECKLIST_FILE=$(realpath "$CHECKLIST_FILE")
elif [[ -f "$(dirname "$TASK_FILE")/quality-checklist.md" ]]; then
    CHECKLIST_FILE="$(dirname "$TASK_FILE")/quality-checklist.md"
else
    CHECKLIST_FILE="${TEMP_DIR}/checklist.md"
    generate_checklist > "$CHECKLIST_FILE"
    log "Generated default quality checklist at ${CHECKLIST_FILE}"
fi

# Extract task description from markdown (remove markdown formatting)
extract_task() {
    local file="$1"
    # Remove markdown headers, code blocks, and other formatting
    sed -e 's/^# .*//' -e 's/^```.*//' -e 's/^---//' -e 's/^- //' -e 's/^> //' -e '/^$/d' "$file" | \
    sed -e ':a; /^[^ \t]/ {N; s/\n / /; ta}' | \
    sed 's/^[ \t]*//;s/[ \t]*$//' | \
    tr -d '\n'
}

TASK_DESCRIPTION=$(extract_task "$TASK_FILE")
TASK_BASENAME=$(basename "$TASK_FILE" .md)
log "Starting orchestration for task: ${TASK_DESCRIPTION:0:60}..."

# Function to run a vibe agent with a task
run_agent() {
    local agent_name="$1"
    local task="$2"
    local output_file="$3"
    shift 3
    local input_files=("$@")

    log "Launching ${agent_name} agent..."

    # Create a temporary task file for the agent
    local task_file="${TEMP_DIR}/${agent_name}_task_${ITERATION}.md"
    echo "$task" > "$task_file"

    # Build the vibe command
    local cmd="vibe"

    # Add task file
    cmd+=" --task-file $task_file"

    # Add input files
    for file in "${input_files[@]}"; do
        if [[ -f "$file" ]]; then
            cmd+=" --files $file"
        fi
    done

    # Set output
    if [[ -n "$output_file" ]]; then
        cmd+=" --output $output_file"
    fi

    # Add model if specified
    if [[ -n "${MODEL:-}" ]]; then
        cmd+=" --model $MODEL"
    fi

    if [[ "$VERBOSE" == "true" ]]; then
        log "Running: $cmd"
        eval "$cmd"
    else
        # Run and capture output
        log "Agent command: $cmd"
        eval "$cmd" > "$output_file" 2>&1 || true
    fi
}

# Function to extract issues from reviewer output
extract_issues() {
    local review_file="$1"
    # Look for checklist items marked as incomplete or issues mentioned
    grep -E '(- \[ \]|- \[x\]|issue|problem|error|fix|change|update|missing|TODO|FIXME|XXX|HACK|should|need to|must|required|fail)' "$review_file" | \
    grep -v '^#' | \
    grep -v '^```' | \
    sed 's/^- \[[ x]\] //' | \
    sed '/^$/d'
}

# Main orchestration loop
ITERATION=0
WORKER_OUTPUT="${OUTPUT_DIR}/worker_output.md"
REVIEWER_OUTPUT="${OUTPUT_DIR}/reviewer_output.md"
FINAL_OUTPUT="${OUTPUT_DIR}/final_result_${TASK_BASENAME}.md"

# Copy task file to output dir for reference
cp "$TASK_FILE" "${OUTPUT_DIR}/original_task.md"

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
    ITERATION=$((ITERATION + 1))
    log "\n--- Iteration $ITERATION of $MAX_ITERATIONS ---"

    # Step 1: Worker agent performs the task
    WORKER_TASK="You are the Worker Agent. Perform the following task exactly as described.

## Task
${TASK_DESCRIPTION}

## Context
- This is iteration $ITERATION of $MAX_ITERATIONS
- Original task file: $TASK_FILE
- Quality checklist will be applied to your work

## Requirements
- Be precise and follow the task exactly
- Make minimal, focused changes
- Follow existing code conventions in the repository
- Document your changes clearly

## Deliverable
When you complete the task, provide:
1. A summary of what you changed and why
2. List of files created or modified
3. Any assumptions you made
4. How to verify the changes work

IMPORTANT: Your work will be reviewed against a quality checklist. Be thorough!"

    log "Starting Worker Agent..."
    run_agent "Worker" "$WORKER_TASK" "$WORKER_OUTPUT" "$TASK_FILE" "$CHECKLIST_FILE"

    # Check if worker completed successfully
    if [[ ! -s "$WORKER_OUTPUT" ]]; then
        log_error "Worker agent produced no output. Check if vibe CLI is available."
        exit 1
    fi

    log "Worker completed. Output: $WORKER_OUTPUT"

    # Step 2: Reviewer agent checks the work
    REVIEWER_TASK="You are the Quality Reviewer Agent. Your job is to review the changes against the quality checklist.

## Task Description
${TASK_DESCRIPTION}

## Worker's Output/Summary
$(cat "$WORKER_OUTPUT")

## Quality Checklist
$(cat "$CHECKLIST_FILE")

## Your Job
Review the worker's changes against the checklist above.

For each item in the checklist that is NOT satisfied, provide:
1. The checklist item number/name
2. What's wrong (be specific)
3. How to fix it (actionable suggestion)

## Response Format
Use this exact format:

## Review Summary
- Total checklist items: X
- Items passed: Y
- Items failed: Z
- All issues fixed: [Yes/No]

## Issues Found
- [ ] [Item Name] - Issue: <specific problem> - Fix: <specific action>
- [ ] [Item Name] - Issue: <specific problem> - Fix: <specific action>

## Detailed Notes
<Any additional observations or praise for good work>

## Final Verdict
[PASS] or [FAIL - needs fixes]

Be strict but fair. Only mark as PASS if ALL checklist items are satisfied."

    log "Starting Reviewer Agent..."
    run_agent "Reviewer" "$REVIEWER_TASK" "$REVIEWER_OUTPUT" "$WORKER_OUTPUT" "$CHECKLIST_FILE" "$TASK_FILE"

    # Parse reviewer output
    ISSUES=$(extract_issues "$REVIEWER_OUTPUT")
    ALL_FIXED=$(grep -i "All issues fixed:" "$REVIEWER_OUTPUT" | grep -i "yes" || echo "")
    VERDICT=$(grep -i "Final Verdict" "$REVIEWER_OUTPUT" | grep -i "PASS" || echo "")
    FAIL_VERDICT=$(grep -i "Final Verdict" "$REVIEWER_OUTPUT" | grep -i "FAIL" || echo "")

    log "Reviewer completed. Issues found: $(echo "$ISSUES" | grep -c '.' || echo '0')"

    # Check if all issues are fixed
    if [[ -n "$VERDICT" ]] || { [[ -z "$ISSUES" ]] && [[ -z "$FAIL_VERDICT" ]]; }; then
        log_success "All quality checks passed!"
        cp "$WORKER_OUTPUT" "$FINAL_OUTPUT"
        
        # Append review summary
        echo "" >> "$FINAL_OUTPUT"
        echo "## Quality Review" >> "$FINAL_OUTPUT"
        echo "All checklist items passed. Review completed on $(date)" >> "$FINAL_OUTPUT"
        break
    fi

    # If we're not fixing, just report and exit
    if [[ "$NO_FIX" == "true" ]]; then
        log_warning "Issues found but --no-fix specified. Review output:"
        echo "========================================"
        cat "$REVIEWER_OUTPUT"
        echo "========================================"
        exit 0
    fi

    # Step 3: Send issues back to worker for fixing
    if [[ $ITERATION -lt $MAX_ITERATIONS ]]; then
        FIX_TASK="You are the Worker Agent. The Quality Reviewer found issues with your work. Please fix them ALL.

## Original Task
${TASK_DESCRIPTION}

## Reviewer's Feedback
$(cat "$REVIEWER_OUTPUT")

## What You Must Do
1. Read the reviewer's feedback carefully
2. Address EVERY issue mentioned
3. Make the required changes
4. Provide an updated summary of all changes (including fixes)

## Your Previous Work
$(cat "$WORKER_OUTPUT")

## Important
- Do not argue with the reviewer
- If you disagree with a point, fix it anyway and note your reasoning
- Your response will be reviewed again - be thorough
- Mark fixed items clearly in your response"

        log "Sending fixes back to Worker Agent..."
        run_agent "Worker" "$FIX_TASK" "$WORKER_OUTPUT" "$REVIEWER_OUTPUT" "$TASK_FILE" "$CHECKLIST_FILE"

        # If no changes were made, we might be stuck
        if [[ ! -s "$WORKER_OUTPUT" ]]; then
            log_error "Worker failed to produce output on fix attempt"
            break
        fi
    fi
done

# Final summary
log "\n========================================"
log "ORCHESTRATION COMPLETE"
log "========================================"

if [[ -f "$FINAL_OUTPUT" ]]; then
    log_success "All quality checks passed!"
    log_success "Final output saved to: $FINAL_OUTPUT"
    log "\nFinal Result:"
    echo "----------------------------------------"
    cat "$FINAL_OUTPUT"
    echo "----------------------------------------"
else
    log_warning "Orchestration completed with remaining issues after $MAX_ITERATIONS iterations."
    log "\nFinal Reviewer Output:"
    echo "----------------------------------------"
    cat "$REVIEWER_OUTPUT"
    echo "----------------------------------------"
    log "\nWorker's Last Output:"
    echo "----------------------------------------"
    cat "$WORKER_OUTPUT"
    echo "----------------------------------------"
fi

log "\nFiles generated:"
log "  - Task file: $TASK_FILE"
log "  - Checklist: $CHECKLIST_FILE"
log "  - Worker output: $WORKER_OUTPUT"
log "  - Reviewer output: $REVIEWER_OUTPUT"
if [[ -f "$FINAL_OUTPUT" ]]; then
    log "  - Final result: $FINAL_OUTPUT"
fi

log "\nTemporary directory (preserved for inspection):"
log "  $TEMP_DIR"
log "\nTo clean up temporary files, run: rm -rf $TEMP_DIR"

log "\nOrchestration script finished."
