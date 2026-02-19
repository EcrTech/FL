
# Add Help Widget Script

The user wants to integrate a help widget by adding a specific script tag to the application.

## Proposed Changes

### 1. Update `index.html`
I will add the following script tag to the `index.html` file:
```html
<script src="https://go-in-sync.lovable.app/help-widget.js" data-source="loanflow"></script>
```

I'll place it just before the closing `</body>` tag to ensure it doesn't interfere with the initial page load performance.

## Technical Details
- **File**: `index.html`
- **Location**: Before the main application script (`/src/main.tsx`) or just before `</body>`.
- **Reasoning**: Standard practice for external widgets to avoid blocking the main thread during initial render.

## Implementation Steps
1.  Open `index.html`.
2.  Insert the script tag before the closing `</body>` tag.
3.  Save the changes.
