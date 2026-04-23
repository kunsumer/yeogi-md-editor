# State, Data, and UX State Rules

- Loading, empty, dirty, error, and saved states must be explicit.
- Document state and on-disk state are not the same thing — reconcile deliberately.
- File I/O and mutation behavior should be observable and testable.
- Unsaved-change, revert, and destructive-file flows need deliberate UX and confirmation.
