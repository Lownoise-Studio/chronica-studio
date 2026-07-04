# Editor Transactions

Foundation Hardening Phase 5 introduces a formal editor transaction model so project mutations are **atomic**, **reversible**, **deterministic**, **validated**, and **observable** — without changing editor UX or package schema.

---

## Transaction lifecycle

Every editor action follows the same pipeline:

```
Begin Transaction
      ↓
   Validate      ← preconditions, reference scans, contract checks
      ↓
    Apply         ← pure project transform on an in-memory copy
      ↓
    Verify        ← postconditions, integrity checks
      ↓
 Commit  |  Rollback
```

Nothing partially applies. If validation or verification fails, the working copy is discarded and the original project is unchanged.

### Core modules

| Module | Purpose |
|--------|---------|
| `engine/editor-transactions.ts` | Transaction runner, dirty-state diff, undo/replay helpers |
| `engine/editor-mutations.ts` | Named mutation definitions + documented contracts |

### API entry points

```typescript
runEditorTransaction(project, mutation)
runEditorTransactionBatch(project, [mutation, ...])
computeEditorChangeSet(before, after)
replayInverseTransaction(afterCommit, committedResult)
verifyTransactionUndo(originalBefore, undoResult)
```

---

## Mutation guarantees

Each mutation is an `EditorMutationDefinition` with:

- `validate(project)` — blocking preconditions
- `apply(project)` — returns a new project snapshot
- `verify(before, after)` — postcondition checks
- `describeChangeSet(before, after)` — structured dirty tracking

Documented contracts live in `EDITOR_MUTATION_CONTRACTS` (`editor-mutations.ts`).

| Mutation | Guarantees |
|----------|------------|
| `updateProjectMutation` | Partial project field patch; siblings preserved |
| `updateFragmentMutation` | Target fragment must exist |
| `renameAssetMutation` | **Asset id immutable**; display name + all name-based references updated atomically |
| `deleteAssetMutation` | Blocked when references or preview dependents exist — **never silently orphans** |
| `applyRecipeMutation` | Recipe plan + fragment + catalog applied in one step |
| `generateRoomMutation` | Room generation + catalog merge applied atomically |
| `moveStageObjectMutation` | Locked objects rejected |
| `createInteractableMutation` | Unique uid required; adventure block created if missing |
| `addAssetsBatchMutation` | All imports commit together or none |

---

## Rollback rules

1. **Validation failure** → status `failed`; no apply attempted.
2. **Apply throw or verify error** → status `rolled_back`; original snapshot retained.
3. **Successful commit** → `before` snapshot stored on `EditorTransactionResult` for undo.

There is **no automatic repair** of dangling references. Delete and rename either succeed cleanly or fail with diagnostics.

---

## Safe delete flow

```
Asset selected
      ↓
getAssetDeleteImpact(project, assetId)
      ↓
Reference scan (scenes, adventure sprites, inventory, previews)
      ↓
Impact report
      ↓
deleteAssetMutation → runEditorTransaction
      ↓
Commit only when zero blocking references
```

Use `executeSafeAssetDelete(project, assetId)` to obtain both the impact report and transaction result.

---

## Safe rename flow

Renaming `Lantern.glb` → `Temple Lantern.glb`:

- Preserves **asset id**
- Rewrites **name-based references** in fragments (backgrounds, stage objects, adventure sprites/SFX, inventory)
- Does **not** change id-based links (e.g. `previewImageAssetId`)
- Rejects duplicate display names

---

## Dirty-state tracking

`computeEditorChangeSet(before, after)` returns:

```typescript
{
  domains: EditorChangeDomain[];      // assets | scenes | adventure | ...
  changedAssetIds: string[];
  changedFragmentUids: string[];
  changedFields: string[];
  summary: string;
}
```

Domains:

- **assets** — library entries added/removed/changed
- **scenes** — fragment graph edits
- **adventure** — `fragment.adventure` changes
- **gameplay-catalog** — inventory, objectives, NPC profiles, etc.
- **runtime-metadata** — initial variables / memory
- **settings** — title, description, start location
- **package-metadata** — `updatedAt`, schema identifiers

No UI is required; editor screens can subscribe later.

---

## Undo / redo foundation (engine only)

No undo UI in Phase 5. Engine helpers only:

```
Committed Transaction
        ↓
buildInverseTransaction(result)  → restore-project mutation
        ↓
replayInverseTransaction(currentProject, result)
        ↓
verifyTransactionUndo(originalBefore, undoResult)
```

Inverse restores the full `before` snapshot captured at commit time. Future undo stacks can push `EditorTransactionResult` objects and replay inverses on demand.

---

## Batch operations

Multi-step or bulk work uses one transaction:

```typescript
runEditorTransactionBatch(project, [
  addAssetsBatchMutation(fiftyAssets),
  updateProjectMutation({ title: 'After import' }),
]);
```

If any step fails validation or verification, **the entire batch rolls back**.

---

## Extension guidelines

1. **Add a mutation helper** in `editor-mutations.ts` — do not mutate project state directly from UI when a helper exists.
2. **Register contract metadata** in `EDITOR_MUTATION_CONTRACTS`.
3. **Keep `apply` pure** — return a new project; no side effects (file I/O stays in UI/storage layers).
4. **Use errors for blockers** — warnings alone do not roll back; use `contractError` for commit blockers.
5. **Compose with `runEditorTransactionBatch`** for multi-field edits that must be atomic (recipes, room generation, imports).
6. **Do not auto-repair** references — report impact and require explicit author action.

---

## Tests

`__tests__/foundation-hardening-phase5.test.ts` covers:

- Rollback on referenced delete
- Rename reference rewrite + id preservation
- Batch apply and batch failure
- Nested validation
- Dirty-state generation
- Undo inverse replay
- Recipe and room atomic mutations

---

## Related docs

- [Foundation Hardening](./FOUNDATION_HARDENING.md) — Phase 5 summary
- [Engine Contracts](./ENGINE_CONTRACTS.md) — asset/recipe/room contract validation
