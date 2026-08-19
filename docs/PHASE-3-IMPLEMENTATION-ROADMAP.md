# Phase 3 Implementation Roadmap

## 3A — Backend model

- Add Habit model
- Add HabitLog model
- Add compound indexes
- Add authenticated CRUD routes
- Add ownership validation
- Add archive behavior

## 3B — Store

- Add Habit accessors
- Add HabitLog accessors
- Add selectors
- Add local-date utility

## 3C — Habit service

- Create/edit/archive
- Complete/skip
- History retrieval
- Streak calculation

## 3D — View model

- `buildHabitViewModel()`
- shared actions
- desktop renderer
- mobile renderer

## 3E — Habit UI

- dedicated page
- today's list
- create/edit modal
- history
- streaks
- archive

## 3F — Dashboard

Add only the compact Today's Habits widget.

## 3G — Backup

- versioned export
- validated restore
- referential integrity

## 3H — Tests

Unit tests first:

- schedule eligibility
- local date
- daily streak
- weekly target
- skipped occurrence
- archived habit
- edit without history corruption
- user ownership
- duplicate log prevention
