# Security Integration Test Plan

## Quick Verification Tests

### Test 1: Rate Limiting on Post Composer
1. Start dev server: `npm run dev`
2. Navigate to feed page
3. Open post composer
4. Try to submit 6 posts in rapid succession
5. **Expected**: After 5 posts, you should see "Too many posts. Please wait a moment before trying again."

### Test 2: File Upload Validation
1. Open post composer
2. Click "Add Image"
3. Try to upload a file larger than 5MB
4. **Expected**: Error message "File size exceeds 5MB limit"
5. Try to upload a .txt or .pdf file
6. **Expected**: Error message "File type ... is not allowed"

### Test 3: Password Strength Indicator
1. Navigate to `/signup`
2. Type password: `abc`
3. **Expected**: Red bar, "weak" label, feedback messages
4. Type password: `Password123!`
5. **Expected**: Green bar, "strong" label, no feedback

### Test 4: Login Rate Limiting
1. Navigate to `/login`
2. Enter incorrect credentials 5 times
3. **Expected**: After 5 attempts, "Too many login attempts. Please wait 15 minutes"
4. Login button should be disabled with text "Locked - Wait 15 minutes"

### Test 5: Input Sanitization
1. Open post composer
2. Enter content: `<script>alert('test')</script>`
3. Submit post
4. **Expected**: Content should be displayed as text, not executed as script
5. Check browser inspector - should see: `&lt;script&gt;alert('test')&lt;/script&gt;`

### Test 6: CSRF Token Presence
1. Open any form (login, signup, post composer)
2. Open browser DevTools -> Elements
3. Search for `csrf_token`
4. **Expected**: Hidden input field with a 64-character hex token

## Automated Test Script

Run this in browser console on signup page:

```javascript
// Test password strength hook
const passwordInputs = [
  'abc',           // Weak
  'password123',   // Weak (common pattern)
  'Abcd1234',      // Fair
  'MyPass123!',    // Good
  'C0mpl3x!Pass@2024'  // Strong
]

// Simulate typing each password
const input = document.querySelector('input[type="password"]')
passwordInputs.forEach((pw, i) => {
  setTimeout(() => {
    input.value = pw
    input.dispatchEvent(new Event('input', { bubbles: true }))
    console.log(`Password "${pw}": Check strength indicator`)
  }, i * 2000)
})
```

## Coverage Summary

| Feature | Login | Signup | Post Composer | Feed Panel |
|---------|-------|--------|---------------|------------|
| CSRF Token | ✓ | ✓ | ✓ | N/A |
| Rate Limiting | ✓ | ✓ | ✓ | ✓ |
| Input Sanitization | N/A | ✓ (name) | ✓ (content) | ✓ (content) |
| Password Strength | N/A | ✓ | N/A | N/A |
| File Validation | N/A | N/A | ✓ | N/A |

