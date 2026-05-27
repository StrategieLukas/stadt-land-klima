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

## Nuxt/Vue Specific
- [ ] Reactive state is properly managed
- [ ] No memory leaks from event listeners
- [ ] Components have proper props validation
- [ ] Async data fetching has proper error handling
- [ ] No unnecessary re-renders (proper :key usage)

## Docker/Infrastructure
- [ ] Container restarts are handled gracefully
- [ ] Volume mounts are correct
- [ ] Environment variables are documented
- [ ] Health checks are configured where appropriate
- [ ] Resource limits are reasonable

## Code Review Readiness
- [ ] All TODO comments are addressed or converted to issues
- [ ] No commented-out code left in
- [ ] No debug console.log statements
- [ ] Changes are committed with descriptive messages
- [ ] PR description explains the changes clearly
