

## Fix: Back Button Not Working

### Problem

The back button on the Application Detail page uses `window.history.length > 1 ? navigate(-1) : navigate("/los/applications")`. In the Lovable preview iframe (and some browser contexts), `window.history.length` is unreliable -- it may not reflect actual navigation history correctly, causing the button to appear functional but do nothing, or navigate incorrectly.

### Solution

Replace the fragile `window.history.length` check with a more robust approach using a **referrer-based strategy**:

1. Track the previous route via React Router's `useLocation` state or a simple check
2. Always call `navigate(-1)` as the primary action
3. Use a `popstate` listener or a short timeout fallback: if the URL hasn't changed after calling `navigate(-1)`, fall back to `/los/applications`

A simpler and equally effective approach: just always use `navigate(-1)` without the history length guard, since React Router manages its own history stack and handles the edge case gracefully.

### Changes

**File: `src/pages/LOS/ApplicationDetail.tsx` (line 473)**

Replace:
```typescript
<Button variant="ghost" size="icon" onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/los/applications")}>
```

With:
```typescript
<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
```

This is a single-line change. React Router's `navigate(-1)` will go back in the router history stack. If there's no previous entry, it stays on the current page (which is acceptable behavior and avoids the broken state).

### Why This Works

- `window.history.length` counts all browser history entries (including external sites), and in iframes it often returns 1 regardless of navigation
- React Router's `navigate(-1)` uses its own internal history stack, which is more reliable
- Removing the conditional eliminates the branch where neither action works correctly
