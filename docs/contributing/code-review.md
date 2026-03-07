# Code Review Guidelines

This document outlines the code review process and expectations for the Parcel Admin Dashboard project.

## Code Review Checklist

When reviewing code, please ensure the following criteria are met:

### 1. Functionality

- [ ] Code implements the intended functionality correctly
- [ ] Edge cases are handled appropriately
- [ ] Error handling is comprehensive and user-friendly
- [ ] No obvious bugs or logical errors
- [ ] Feature works as described in the PR description

### 2. Code Quality

- [ ] Code is readable and well-organized
- [ ] Variable and function names are descriptive and follow conventions
- [ ] Code follows the project's style guide and conventions
- [ ] No unnecessary complexity or over-engineering
- [ ] DRY principle is followed (Don't Repeat Yourself)
- [ ] SOLID principles are applied where appropriate
- [ ] No commented-out code or debug statements

### 3. Testing

- [ ] Unit tests are included for new functionality
- [ ] Integration tests are included where appropriate
- [ ] E2E tests are included for critical user workflows
- [ ] All tests pass locally and in CI
- [ ] Test coverage meets the minimum threshold (60%)
- [ ] Tests are meaningful and test the right things

### 4. Security

- [ ] No sensitive data (API keys, passwords, tokens) in code
- [ ] Input validation is implemented for user inputs
- [ ] SQL injection vulnerabilities are prevented
- [ ] XSS vulnerabilities are prevented through proper sanitization
- [ ] Authentication and authorization are properly implemented
- [ ] Security headers are configured correctly
- [ ] Dependencies have no known critical vulnerabilities

### 5. Performance

- [ ] No obvious performance bottlenecks
- [ ] Database queries are optimized (proper indexes, no N+1 queries)
- [ ] Large datasets are paginated or lazy-loaded
- [ ] Expensive operations are cached where appropriate
- [ ] API response times are within acceptable limits
- [ ] Bundle size impact is considered for frontend changes

### 6. Documentation

- [ ] Code is self-documenting or includes necessary comments
- [ ] Complex logic is explained with comments
- [ ] Public APIs have JSDoc comments
- [ ] README is updated if necessary
- [ ] Migration scripts include clear descriptions
- [ ] Breaking changes are documented

## Review Response Time Expectations

- **Initial Review**: Within 1 business day for standard PRs
- **Follow-up Reviews**: Within 4 hours for subsequent review rounds
- **Urgent/Hotfix PRs**: Within 2 hours

## Approval Requirements

- **Standard PRs**: Require 1 approval from a team member
- **Breaking Changes**: Require 2 approvals, including a senior developer
- **Security-related PRs**: Require approval from a security-aware reviewer
- **Database Migrations**: Require approval from a database-aware reviewer

## Providing Constructive Feedback

### Do's

- **Be specific**: Point to exact lines and explain the issue
- **Explain why**: Help the author understand the reasoning
- **Suggest alternatives**: Provide concrete suggestions for improvement
- **Acknowledge good work**: Highlight well-written code or clever solutions
- **Ask questions**: Use questions to understand the author's reasoning
- **Be respectful**: Remember there's a person behind the code

### Don'ts

- **Don't be vague**: Avoid comments like "this looks wrong"
- **Don't be dismissive**: Avoid "just rewrite this" without explanation
- **Don't nitpick excessively**: Focus on important issues first
- **Don't make it personal**: Focus on the code, not the person
- **Don't block on style**: Use automated tools for style enforcement

### Example Comments

**Good**:

```
This function could be simplified by using Array.filter() instead of the for loop.
This would make it more readable and idiomatic. Example:
return items.filter(item => item.status === 'active');
```

**Not Good**:

```
This is wrong. Fix it.
```

## Security Review Requirements

All PRs must be reviewed for security concerns:

- [ ] Authentication and authorization logic is correct
- [ ] User inputs are validated and sanitized
- [ ] Sensitive data is not logged or exposed
- [ ] API endpoints have proper rate limiting
- [ ] CORS configuration is appropriate
- [ ] Dependencies are up to date and have no critical vulnerabilities

## Performance Review Requirements

PRs that affect performance-critical paths must be reviewed for:

- [ ] Database query efficiency (use EXPLAIN ANALYZE if needed)
- [ ] API response time impact
- [ ] Frontend bundle size impact
- [ ] Memory usage considerations
- [ ] Caching strategy appropriateness

## Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries

### Scope

The scope should be the name of the affected module or component (e.g., `auth`, `dashboard`, `api`, `db`).

### Subject

- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end
- Limit to 50 characters

### Body

- Use the imperative, present tense
- Include motivation for the change and contrast with previous behavior
- Wrap at 72 characters

### Footer

- Reference issues and PRs
- Note breaking changes with `BREAKING CHANGE:` prefix

### Examples

**Feature**:

```
feat(dashboard): add period comparison chart

Implement a new chart component that allows users to compare
metrics between two time periods side by side.

Closes #123
```

**Bug Fix**:

```
fix(auth): prevent session timeout during active use

Update session refresh logic to extend the session when the user
is actively interacting with the application.

Fixes #456
```

**Breaking Change**:

```
feat(api): change response format for dashboard endpoint

BREAKING CHANGE: The /api/dashboard endpoint now returns data in
a nested structure instead of a flat array. Update client code to
access data via response.data.metrics instead of response.metrics.

Closes #789
```

**Refactoring**:

```
refactor(validation): extract common validation logic

Move shared validation functions to a separate utility module
to reduce code duplication across API routes.
```

## Merging Pull Requests

- **Squash and merge** is preferred for feature branches to keep history clean
- **Merge commit** is acceptable for long-lived feature branches with meaningful commit history
- **Rebase and merge** is acceptable for small, atomic changes
- Ensure the PR title follows commit message conventions (it becomes the commit message)
- Delete the branch after merging

## Handling Disagreements

If there's a disagreement during code review:

1. Discuss the issue respectfully in the PR comments
2. Provide evidence or examples to support your position
3. If consensus cannot be reached, escalate to a senior developer or team lead
4. Document the decision and reasoning for future reference

## Resources

- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [Google's Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [GitHub's Code Review Best Practices](https://github.com/features/code-review/)
