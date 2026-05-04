# UX_STATES

Every flow that touches a file must define these states explicitly.

## File / document states
- no document open (empty)
- loading a large file
- loaded, clean
- loaded, dirty (unsaved changes)
- save in progress
- save failed (permission, disk full, path gone)
- external change detected on disk
- file moved or deleted while open

## Editor states
- focus vs. blur
- read-only (unsupported encoding, file too large, locked)
- find / replace active
- undo / redo at boundary

## Destructive confirmations
- closing a dirty document
- quitting with dirty documents
- overwriting an existing file
- reverting to on-disk version

## Error surfaces
- inline in editor chrome vs. modal alert
- recoverable vs. fatal copy tone

For each critical flow, note the copy tone and the escalation path.
