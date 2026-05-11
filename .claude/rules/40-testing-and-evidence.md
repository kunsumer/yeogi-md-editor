# Testing and Evidence

- Touching views, document logic, or file I/O should usually update tests.
- Minimum expected checks when relevant:
  - lint
  - typecheck
  - unit / component tests
  - integration or UI tests for user-visible behavior
  - accessibility checks when the UI changes materially
- Never overstate confidence beyond the checks actually run.
