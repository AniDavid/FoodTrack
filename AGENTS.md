# Food Track – AI Agent Instructions

## Project Overview
Food Track is a **Hebrew-language food tracking PWA** that logs daily meals with calories. Uses vanilla JS + localStorage (no frameworks). Data persists across sessions on the user's device.

## Key Files
- `index.html` – Main app UI (calendar, forms, modal, cloud sync modal)
- `script.js` – App logic: calendar rendering, CRUD operations, localStorage persistence, sync UI controller
- `firebase-config.js` – Firebase project configuration loader (reads from file or localStorage)
- `firebase-sync.js` – Firebase v10 SDK integration: Google Auth, Cloud Firestore real-time sync, offline persistence, and conflict-free merge
- `style.css` – RTL-first styling with purple theme (#9a84d9 background)
- `manifest.webmanifest` – PWA configuration
- `sw.js` – Service worker for offline support

## Core Conventions & Patterns

### 1. Date Handling
- Use `formatDateKey(date)` → returns `"YYYY-MM-DD"` string keys
- Calendar state tracked in `currentViewDate` (Date object)
- Selected day tracked in `selectedDateKey` (string)

### 2. Data Model
```js
// localStorage key: 'foodTrackerData'
{
  "2026-08-12": [
    {
      id: "1234567890",
      foodName: "תפוח",
      foodType: "פרי",
      quantity: 150,
      unit: "גרם",
      calories: 52,
      time: "12:30" // HH:mm Hebrew locale format
    }
  ]
}

// localStorage key: 'foodTrackerOptions'
{
  foodNames: ["תפוח", "בננה"],
  foodTypes: ["פרי", "ירוק"],
  units: ["גרם", "מיליליטר"],
  associations: {
    "תפוח": { type: "פרי", unit: "גרם" }
  }
}
```

### 3. Form Patterns
- Dropdowns have `"__new"` option to trigger custom input field
- Use `getDropdownValue(select, customInput)` to get actual value (either selected or custom)
- Auto-populate dropdown options on first app load via `loadOptionData()`

### 4. Calendar Rendering
- Month header shows Hebrew month name in format: `"ינואר 2026"`
- First day calculation uses native Date API (0=Sunday, 6=Saturday)
- Fillers added for RTL layout alignment
- Day elements have `data-date="YYYY-MM-DD"` attribute

### 5. CRUD Operations
- **Create**: `addFoodEntry()` → saves to localStorage + updates calendar markers
- **Read**: `renderDailyLog()` → shows entries for selected date
- **Update**: `enterEditMode(id)` → populates form, changes button to "שמור שינויים"
- **Delete**: Event delegation on `dailyLogListEl` → confirms before removing

### 6. Localization
- All UI text in Hebrew (`he-IL` locale)
- RTL layout (`dir="rtl"` on body)
- Calendar days: `['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']`

### 7. PWA Features
- Service worker at `sw.js` handles caching
- App installable via manifest
- Can be added to home screen as standalone app

## Common Pitfalls
1. **Date key mismatch**: Always use `formatDateKey()` for consistency
2. **Missing options**: First load always calls `loadOptionData()` to build dropdowns from historical data
3. **Editing state**: Track `editingEntryId` to distinguish add vs edit mode
4. **RTL layout**: CSS assumes RTL; left/right properties may need mirroring

## Function Reference
All functions are in `script.js`. Key exported/utility functions:

**Data Management:**
- `loadFoodData()` → loads from `foodTrackerData` localStorage key
- `saveFoodData(data)` → persists to `foodTrackerData`
- `loadOptionData()` → loads from `foodTrackerOptions` + builds from historical data
- `saveOptionData(data)` → persists to `foodTrackerOptions`
- `rememberFoodAssociation(foodName, foodType, unit)` → updates associations for auto-populate

**UI Rendering:**
- `renderCalendar(date)` → renders month view, highlights days with food entries
- `renderDailyLog()` → displays entries for `selectedDateKey`, shows daily calorie total
- `populateDropdowns()` → initializes all select elements with historical options

**Form Handling:**
- `addFoodEntry(event)` → form submit handler; creates or updates entry; calls `renderCalendar()` + `renderDailyLog()`
- `enterEditMode(entryId)` → populates form with entry data, sets button to "שמור שינויים"
- `resetFormFields()` → clears form inputs and hides custom fields
- `resetFormEditingState()` → resets `editingEntryId`, button text, cancel button visibility
- `getDropdownValue(selectElement, customInput)` → returns selected value or custom input text
- `toggleCustomField(selectElement, customInput)` → shows/hides custom input based on "__new" selection

**Calendar Navigation:**
- `goToPreviousMonth()`, `goToToday()`, `goToNextMonth()` → update `currentViewDate` + re-render
- `handleDateClick(element)` → sets `selectedDateKey`, renders daily log, shows form overlay
- `formatDateKey(date)` → returns YYYY-MM-DD string (used throughout)

**Event Setup:**
- `setupEventListeners()` → wires all button clicks and form inputs; uses event delegation on `dailyLogListEl` for delete

## Event Delegation Pattern
Delete button clicks are handled via event delegation on `#daily-log-list`:
```js
dailyLogListEl.addEventListener('click', (event) => {
    if (event.target.className === 'delete-btn') {
        const entryId = event.target.dataset.id;
        if (confirm('Delete?')) removeEntry(entryId);
    }
});
```
This allows delete buttons to work on dynamically added entries without re-wiring listeners.

## Deployment & Versioning
**Cache Busting** (required on every deploy):
1. Update `CACHE_NAME` in `sw.js` → `'food-track-v' + new date` (currently: `'food-track-v2026-08-16'`)
2. Update `manifest.webmanifest` → `id` and `start_url` version param (currently: `?v=2026-08-16`)
3. Example: For release 2026-08-16, change all `2026-08-11` → `2026-08-16`

**Deployment:**
- No build step required (vanilla JS)
- Deploy all static files to GitHub Pages or similar hosting
- Service worker auto-registers via manifest link in HTML
- Icon asset `FoodTrackIcon3D.png` must be deployed

## Quick Start for Developers
When working on this project:

1. **Running the app**: Open `index.html` in a browser (no build step needed)
2. **Testing locally**: Use a local HTTP server for service worker testing:
   ```bash
   python -m http.server 8000  # or similar
   ```
3. **Inspecting data**: Open browser DevTools → Application → Local Storage → `foodTrackerData` and `foodTrackerOptions`
4. **Adding a feature**:
   - Add DOM element to `index.html` if needed
   - Add or modify function in `script.js`
   - Update style in `style.css` (remember RTL layout)
   - If cache needs updating, follow Deployment & Versioning section
5. **Testing in production**: Use DevTools → Application → Service Workers to manually trigger service worker updates

## Documentation Links
- Hebrew user guide: [`instructions-hebrew.html`](./instructions-hebrew.html)
- Preview/redesign docs: Check `preview-mobile-redesign.html` for mobile-specific features
