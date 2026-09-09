---
name: test-in-browser
description: "Test a feature in the browser using the Playwright MCP server"
---

# Browser Testing with Playwright MCP

You have access to a **Playwright MCP server** that lets you control a headless Chromium browser. Use it to verify features work end-to-end by navigating the running app, interacting with elements, and checking results.

## Workflow

### 1. Ensure the dev server is running

The app needs to be running before you can browse it. Check if it's already up:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ || echo "not running"
```

If not running, start it:

```bash
script/server &
sleep 3  # Wait for both servers to start
```

- **Flask backend**: http://localhost:5000 (serves HTML pages + JSON API)
- **Vite dev server**: http://localhost:5173 (serves JS/CSS assets with HMR)

### 2. Navigate to the app

Start at the root page:
- URL: `http://localhost:5000/`

### 3. Understand the page

Use **accessibility snapshots** (not screenshots) to understand what's on the page. The accessibility tree gives you semantic structure — headings, buttons, form fields, links — which is more reliable than visual inspection.

### 4. Interact with elements

Use the MCP tools to:
- **Click** buttons and links
- **Fill** form inputs with text
- **Press** keyboard keys (Enter, Tab, etc.)
- **Wait** for network requests or element changes

### 5. Verify results

After interactions, take another accessibility snapshot to confirm the page updated correctly. Check for:
- New elements appearing (e.g., a message added to the list)
- Elements disappearing (e.g., after deletion)
- Error messages or validation states
- Correct content in dynamic regions

### 6. Report findings

Summarize what you tested and the results:
- ✅ What worked as expected
- ❌ What broke or behaved unexpectedly
- Include specific details (element text, error messages, unexpected states)

## App-Specific Knowledge

### Pages & Routes

| URL | Description |
|-----|-------------|
| `http://localhost:5000/` | Main page — renders Hello island with greeting form |

### React Islands

The app uses **React Islands** — server-rendered HTML with selective React hydration:
- Islands are marked with `data-island` attributes in the HTML
- The **Hello island** (`data-island="hello"`) is the main interactive component
- Initial data is passed via `data-props` attribute from the server
- React fetches fresh data from the API on mount

### Hello Island Features

The Hello island at `/` has:
- **Text input**: placeholder "Enter a greeting..." — type a message here
- **Add button**: submits the form to create a new greeting
- **Message list**: shows all greetings with delete buttons
- **Loading state**: button shows "Adding..." while submitting
- **Error display**: red banner appears on validation/server errors

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hello` | List all greetings |
| POST | `/api/hello` | Create greeting (`{"message": "text"}`) |
| GET | `/api/hello/:id` | Get single greeting |
| DELETE | `/api/hello/:id` | Delete greeting (returns 204) |

### Common Test Scenarios

1. **Add a greeting**: Fill input → click Add → verify message appears in list
2. **Delete a greeting**: Click delete button on a message → verify it disappears
3. **Validation**: Try submitting empty form → verify error message appears
4. **Page load**: Navigate to `/` → verify island hydrates and shows form
5. **API round-trip**: Add a message → refresh page → verify it persists
