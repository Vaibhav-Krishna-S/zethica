# ZETHICA Chat Widget — Manual Testing Checklist

## Overview

This checklist covers comprehensive manual testing of the Phase A Step 3 chat widget implementation. Use this to verify the widget works correctly across browsers, devices, themes, and user scenarios.

**Test Environment:**
- Local development server (e.g., `vercel dev` or `npm run dev`)
- `.env.local` configured with `POSTGRES_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- Recent browser versions (Chrome, Firefox, Safari, Edge)
- Mobile devices or browser DevTools device emulation

---

## 1. Widget Initialization & Visibility

### Desktop

- [ ] Launcher button appears in bottom-right corner
- [ ] Launcher button is visible on first page load
- [ ] Launcher button has ZETHICA colors (forest green gradient)
- [ ] Launcher button has proper spacing from page edges (20px bottom, 20px right)
- [ ] Launcher button is always on top (z-index working)
- [ ] Launcher button doesn't cover page content (not on top of footer buttons)

### Mobile (320px - 480px)

- [ ] Launcher button appears and is accessible on small screens
- [ ] Launcher button position adjusted for mobile (16px from edges)
- [ ] Button doesn't obscure mobile navigation or critical controls
- [ ] Button size appropriate for touch (56px diameter)

### Tablet (481px - 1024px)

- [ ] Widget displays correctly
- [ ] Launcher button in correct position
- [ ] Chat panel size reasonable for tablet (380px width)

---

## 2. Opening & Closing the Widget

### Open Interaction

- [ ] Clicking launcher button opens the chat panel
- [ ] Panel slides up and fades in smoothly
- [ ] Panel appears above launcher button
- [ ] Backdrop overlay appears (darkens background on mobile)
- [ ] Focus moves to input field after opening
- [ ] Launcher button visual state changes (or badge becomes clear)

### Close Interaction

- [ ] Clicking close button (×) closes the panel
- [ ] Panel slides down and fades out smoothly
- [ ] Backdrop overlay disappears
- [ ] Focus returns to page (or launcher button)
- [ ] Clicking backdrop closes panel on mobile
- [ ] Pressing Escape key closes panel

### Toggle Behavior

- [ ] Opening and closing multiple times works consistently
- [ ] Panel doesn't get stuck or show glitches

---

## 3. Welcome Message & Quick Actions

### Welcome Display

- [ ] Welcome message displays correctly: "Hi, Welcome to ZETHICA"
- [ ] Welcome icon visible and styled correctly
- [ ] Welcome text is readable and properly aligned
- [ ] Subtext explains what the widget does

### Quick Action Buttons

- [ ] Four quick action buttons visible:
  - "Services"
  - "Pricing"
  - "AI Services"
  - "Get Started"
- [ ] Each button has proper styling (green border, white text on hover)
- [ ] Buttons are clickable and have hover effects
- [ ] Buttons are accessible via keyboard Tab navigation

### Quick Action Behavior

- [ ] Clicking a button populates the input field with the message
- [ ] Input field receives focus after clicking
- [ ] Message is NOT auto-sent (allows user to edit)
- [ ] User can modify the message before sending
- [ ] Button click doesn't close the widget

---

## 4. Typing & Input

### Input Field Behavior

- [ ] Input field is focused when widget opens
- [ ] Placeholder text visible: "Type your message..."
- [ ] Text can be typed into the field
- [ ] Maxlength="2000" enforced (can't type past 2000 chars)
- [ ] Character counter updates: "0 / 2000" → "5 / 2000" etc.
- [ ] Character counter is readable and non-intrusive

### Keyboard Support

- [ ] Typing works normally
- [ ] Enter key sends the message
- [ ] Shift+Enter can create new lines (if multiline supported)
- [ ] Escape key closes the widget
- [ ] Tab navigates through buttons and controls
- [ ] Focus visible on all interactive elements (for keyboard users)

### Message Validation (Client-Side)

- [ ] Empty messages not sent (input disabled or error)
- [ ] Whitespace-only messages not sent
- [ ] Very long messages (2000+ chars) can't be entered
- [ ] User gets feedback if attempting to send empty message

---

## 5. Sending Messages & API Integration

### Message Send Success

- [ ] Clicking send button sends the message
- [ ] Message appears in chat as "user" message (right-aligned, green background)
- [ ] User message displays exactly what was typed
- [ ] Input field clears after sending
- [ ] Loading indicator appears (3 dots animating)
- [ ] Send button is disabled during request
- [ ] Input field is disabled during request

### API Response Success (200 OK)

- [ ] Loading indicator disappears when response arrives
- [ ] AI response appears in chat (left-aligned, light background)
- [ ] Response text is readable
- [ ] Sources display below response with label "📄 Sources:"
- [ ] Each source shows filename and section heading
- [ ] Response is scrolled into view automatically

### After Message

- [ ] Send button is re-enabled
- [ ] Input field is re-enabled and focused
- [ ] Character counter resets to "0 / 2000"
- [ ] User can send another message
- [ ] Message history preserved (all previous messages visible)

### Unread Badge

- [ ] When widget is closed and AI responds, unread badge appears on launcher
- [ ] Badge shows count of unread messages (e.g., "1", "2")
- [ ] Badge styling: amber background, readable number
- [ ] Opening widget clears badge and count resets
- [ ] Badge disappears once messages are read

---

## 6. Error Handling

### Network Error (Connection Lost)

- [ ] Close network tab in DevTools before sending
- [ ] Loading indicator appears
- [ ] After ~30 seconds, error message appears: "⚠️ Connection error..."
- [ ] Error message is readable and user-friendly
- [ ] Send button re-enabled
- [ ] User can retry

### HTTP 400 (Bad Request)

- [ ] Send a message with invalid format (shouldn't happen with widget)
- [ ] Error message: "❌ Invalid request..."
- [ ] Controls re-enabled for retry

### HTTP 429 (Rate Limit - Server)

- [ ] Send 10 messages quickly
- [ ] 11th message triggers 429
- [ ] Error message appears: "⏱️ Rate limit reached..."
- [ ] Rate limit UI shows countdown (60s timer)
- [ ] Input field and send button disabled during countdown
- [ ] After 60s, controls re-enable

### HTTP 500 (Server Error)

- [ ] Error message: "❌ Server error..."
- [ ] Message suggests trying again later
- [ ] No stack traces or internal errors exposed
- [ ] User can retry after a moment

### Loading State

- [ ] While request is pending, loading indicator visible
- [ ] 3-dot animation smooth and not too fast
- [ ] Indicator persists until response or error

---

## 7. Rate Limiting

### Client-Side Rate Limit (Per-Session)

- [ ] Send 10 messages within 60 seconds
- [ ] 11th message blocked with message: "You've sent 10 messages in the last 60 seconds..."
- [ ] Rate limit notice appears below messages
- [ ] Countdown timer shows "60" and counts down
- [ ] Input disabled during countdown
- [ ] After 60s, timer disappears and controls re-enable
- [ ] Can send message again after reset

### Rate Limit UI

- [ ] Timer displayed clearly: "Rate limited. Please wait 60s."
- [ ] Timer counts down: 60, 59, 58... → 1
- [ ] When reaches 0, notice disappears
- [ ] Styling visible and not distracting

### Rate Limit Persistence

- [ ] Close and reopen widget (client-side rate limit persists)
- [ ] Message counts are tracked per session
- [ ] After page reload, rate limit counter resets

---

## 8. Theme Synchronization

### Dark Theme (Default)

- [ ] Open widget, confirm dark theme colors:
  - Panel: dark background
  - User messages: forest green background
  - AI messages: slightly lighter dark background
  - Text: light colored
- [ ] Colors match ZETHICA brand palette
- [ ] Good contrast and readability

### Light Theme

- [ ] Click theme toggle in navbar (sun/moon icon)
- [ ] Widget updates immediately to light theme:
  - Panel: white background
  - User messages: forest green (same)
  - AI messages: light green-tinted background
  - Text: dark colored
- [ ] All text readable
- [ ] Contrast meets accessibility standards

### Theme Toggle

- [ ] Toggle theme multiple times
- [ ] Widget switches correctly each time
- [ ] No lag or glitches
- [ ] Message history remains visible
- [ ] Open/close widget in different theme

### Theme Persistence

- [ ] Close widget, toggle theme, reopen
- [ ] Widget uses current page theme

---

## 9. XSS Protection & Security

### HTML Injection Prevention

- [ ] Send message: `<script>alert('xss')</script>`
- [ ] Message displays as literal text, not executed
- [ ] No script tags in DOM (check DevTools)
- [ ] No console errors

### Link Safety

- [ ] Send message with link: `Visit https://google.com`
- [ ] Link displays as text, not clickable (safe rendering)
- [ ] No way to inject onclick handlers

### Source Display Safety

- [ ] AI response sources safely displayed
- [ ] Source filenames can't inject HTML
- [ ] No `innerHTML` usage for user content (verify in code)

### API Key Security

- [ ] Open DevTools Network tab
- [ ] Send a message
- [ ] Inspect POST request to `/api/chat`
- [ ] API key NOT visible in request (headers clean)
- [ ] Request body only contains `{"message": "..."}`
- [ ] Response doesn't contain API key or secrets
- [ ] System prompt NOT sent to client

---

## 10. Accessibility

### Keyboard Navigation

- [ ] Tab key navigates through widget controls
- [ ] Focus visible on all buttons (outline ring)
- [ ] Can open/close widget with keyboard
- [ ] Can send message using Enter key
- [ ] Quick action buttons accessible via Tab
- [ ] Focus order logical (launcher → buttons → input → send)

### ARIA Labels & Roles

- [ ] Open DevTools, inspect elements:
  - Launcher has `aria-label="Open ZETHICA chat"`
  - Panel has `role="dialog"` and `aria-modal="true"`
  - Close button has `aria-label="Close chat panel"`
  - Messages container has `role="log"`
  - Input has `aria-label` and `aria-describedby`
  - Send button has `aria-label="Send message"`

### Screen Reader Testing (if available)

- [ ] Launch NVDA or JAWS
- [ ] Navigate to widget
- [ ] Launcher announced as button
- [ ] Panel announced as dialog
- [ ] Messages announced as they appear
- [ ] Button labels clear and descriptive

### Color Contrast

- [ ] All text meets WCAG AA contrast ratio (4.5:1 minimum)
- [ ] Check in DevTools Accessibility panel
- [ ] User messages (white text on green) sufficient
- [ ] AI messages (dark text on light) sufficient
- [ ] Buttons and controls sufficient

### Reduced Motion

- [ ] Enable `prefers-reduced-motion: reduce` in DevTools
- [ ] Widget opens/closes without animation
- [ ] Message appearance without animation
- [ ] Core functionality still works

---

## 11. Responsive Design

### Mobile (375px - 480px)

- [ ] Widget panel resizes to fit screen (full width minus margins)
- [ ] Header fits without truncation
- [ ] Messages readable without horizontal scroll
- [ ] Input field large enough for touch
- [ ] Send button easily tappable (48px+ touch target)
- [ ] Quick actions stack or resize appropriately
- [ ] Backdrop overlay visible on open

### Tablet (600px - 900px)

- [ ] Panel displays at optimal width (~380px)
- [ ] All content visible without excessive scrolling
- [ ] Quick actions display in grid or row

### Desktop (1200px+)

- [ ] Panel fixed at 380px wide
- [ ] Right-aligned position maintained
- [ ] No overlapping with main content
- [ ] Scrollable message area works smoothly

### Landscape Mobile

- [ ] Widget accessible and usable
- [ ] No elements cut off or hidden
- [ ] Panel height adapts if needed

---

## 12. Performance

### Load Time

- [ ] Page loads without widget blocking
- [ ] Widget script loads asynchronously (non-blocking)
- [ ] No layout shift when widget initializes
- [ ] Widget appears quickly after page load

### Interaction Responsiveness

- [ ] Sending message feels instant (no noticeable lag)
- [ ] Button clicks responsive (no delay)
- [ ] Message display appears immediately
- [ ] Theme toggle smooth and instant
- [ ] Scrolling in message area smooth

### Memory

- [ ] Open/close widget multiple times (10+)
- [ ] No memory leaks (DevTools Memory tab)
- [ ] Heap size stays reasonable
- [ ] No garbage in console

### Network

- [ ] One POST request per message sent
- [ ] No duplicate requests
- [ ] Request size reasonable (~100-200 bytes typical)
- [ ] Response parsed quickly

---

## 13. Browser Compatibility

### Chrome / Chromium

- [ ] All features work
- [ ] Smooth animations
- [ ] Correct colors and styling
- [ ] No console errors

### Firefox

- [ ] All features work
- [ ] Animations smooth
- [ ] Styling correct
- [ ] Scrollbar styled (if visible)

### Safari

- [ ] All features work
- [ ] Animations work (may use fallbacks)
- [ ] Colors and styling correct
- [ ] Mobile Safari (iOS) works on real device if possible

### Edge

- [ ] All features work
- [ ] Styling and animations correct

### Mobile Browsers

- [ ] Chrome Mobile: fully functional
- [ ] Safari Mobile (iOS): fully functional
- [ ] Firefox Mobile: fully functional

---

## 14. Integration with Existing Site

### No Conflicts

- [ ] Widget doesn't break existing navbar
- [ ] Doesn't interfere with theme toggle
- [ ] Doesn't affect existing contact form
- [ ] Doesn't hide other page elements
- [ ] Existing animations/scroll effects unchanged

### Z-index Layering

- [ ] Widget appears above all page content
- [ ] Backdrop visible but page content readable
- [ ] Close button accessible
- [ ] No "stuck" states

### Mobile Navigation

- [ ] Hamburger menu still works
- [ ] Mobile menu doesn't conflict with widget
- [ ] Can close menu and use widget independently

---

## 15. Message Content Handling

### Text Messages

- [ ] Long messages wrap correctly
- [ ] Multiple lines display properly
- [ ] Line breaks preserved (if entered)
- [ ] Emojis display if included in response
- [ ] Special characters encoded safely

### Sources Display

- [ ] Source files display correctly
- [ ] Section headings clear and readable
- [ ] Multiple sources listed and organized
- [ ] No sources case: "No sources" message or empty list

### Response Formatting

- [ ] No HTML tags visible in response
- [ ] Response is plain text or safely rendered
- [ ] Links are plain text (not clickable)
- [ ] No markdown rendering (unless intentional)

---

## 16. Data & Privacy

### No Persistence

- [ ] Close widget, reopen: message history cleared
- [ ] Refresh page: message history cleared
- [ ] Close browser tab: history lost (not stored in localStorage)
- [ ] No cookies stored for chat

### Session Isolation

- [ ] Open two tabs with same site
- [ ] Send messages in tab 1, then tab 2
- [ ] Rate limits independent per tab
- [ ] Message histories isolated

### Privacy

- [ ] No user data logged locally (except session memory)
- [ ] Messages not persisted to database
- [ ] No tracking pixels or analytics
- [ ] No third-party requests (except OpenRouter for AI)

---

## 17. Edge Cases

### Empty Input

- [ ] Can't send empty message
- [ ] Can't send whitespace-only message
- [ ] Error feedback provided

### Very Long Message

- [ ] Type 2000 characters (maxlength enforced)
- [ ] Message sends and displays correctly
- [ ] Response wraps and displays properly

### Rapid Clicking

- [ ] Spam send button (shouldn't send duplicates)
- [ ] Open/close repeatedly (no glitches)
- [ ] Toggle theme rapidly (no lag)

### API Timeout

- [ ] Manually timeout API request (take >30s)
- [ ] Error message appears
- [ ] Widget recovers and allows retry

### No Network

- [ ] Disable internet
- [ ] Try to send message
- [ ] Error message appears
- [ ] Controls still responsive

### Widget Closed During Request

- [ ] Send message
- [ ] Close widget before response
- [ ] Response arrives (response visible if reopened, or handled gracefully)

---

## 18. Cross-Origin & CORS

### Same-Origin Requests

- [ ] All requests to `/api/chat` are same-origin
- [ ] No CORS errors in console
- [ ] Requests succeed

### CORS Headers

- [ ] Verify in DevTools that CORS headers present
- [ ] `Access-Control-Allow-Origin` set correctly
- [ ] No CORS blocking

---

## Test Results Summary

**Date:** _______________  
**Tester Name:** _______________  
**Browser/Device:** _______________  
**OS/Version:** _______________

### Overall Status
- [ ] All tests passed
- [ ] Some tests failed (list below)
- [ ] Major issues found (list below)

### Failed Tests

If any tests failed, list them here:

```
1. 
2. 
3. 
```

### Major Issues

Any blockers or critical issues:

```
1. 
2. 
```

### Notes

Additional observations or comments:

```




```

### Sign-Off

- [ ] Ready for Phase A Step 4 (end-to-end testing)
- [ ] Needs fixes before proceeding

---

## Command Reference

**Run widget tests:**
```bash
node tests/widget.test.js
```

**Run API tests:**
```bash
node tests/chat.test.js
```

**Run both:**
```bash
node tests/chat.test.js && node tests/widget.test.js
```

**Local dev server (if using Vercel):**
```bash
vercel dev
```

**View network requests:**
- Chrome/Edge/Firefox: F12 → Network tab
- Monitor POST to `/api/chat`

**Check console for errors:**
- F12 → Console tab
- Should be clean (no errors)

**Check accessibility:**
- F12 → DevTools → Accessibility panel
- Verify color contrast, ARIA roles
