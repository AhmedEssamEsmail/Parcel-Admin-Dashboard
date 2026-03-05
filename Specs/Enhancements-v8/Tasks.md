# Enhancements-v8.0 Tasks

## Phase 1 - Documentation scaffold
- [x] Create `Specs/Enhancements-v8.0/Requirements.md`
- [x] Create `Specs/Enhancements-v8.0/Design.md`
- [x] Create `Specs/Enhancements-v8.0/Tasks.md`

## Phase 2 - v7.1 Plan Documentation Mapping
- [x] Document date format standardization (`MMM-DD`) across analytics chart/table date fields.
- [x] Document WoW period label formatting decision (`MMM-DD` for week/month labels).
- [x] Document On-Time chart visual updates (height +25%, solid legend swatches for lines, medium gray On Time line).
- [x] Document comparison widget layout decision (Change card aligned with Period A/B cards).
- [x] Document WoW global expand/collapse-all control behavior.
- [x] Document Delivery Minutes Trend + Route Efficiency Avg Minutes HH:MM formatting.
- [x] Document Raw Delivery Stages date/time rendering (`MMM-DD` / `MMM-DD HH:MM:SS`).

## Phase 3 - Constraints and impact
- [x] Record that there are no backend API contract changes.
- [x] Record that there are no DB schema/migration changes.
- [x] Record affected frontend file set.

## Phase 4 - Verification checklist (documentation)
- [ ] `npm run build`
- [ ] `npm run validate`
- [ ] `npm run test:run`
- [ ] `npm run test:integration`
- [ ] `npm run type-check`
- [ ] `npm run lint`
- Note: Keep unchecked in this documentation-only task unless explicitly re-run for this documentation commit.
