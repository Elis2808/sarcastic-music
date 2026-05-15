# Sarcastic Music - Feature Testing Checklist

## How to Use This Checklist
- [ ] = Not tested
- [x] = Tested and working
- [!] = Issue found (describe in notes)

---

## 1. Toast Notifications System

### Test Cases:
- [ ] **Success Toast**: Analyze a file in KeyFinder - should see "Key detected: X Major" toast
- [ ] **Error Toast**: Try to analyze invalid URL - should see error toast
- [ ] **Info Toast**: Drag URL onto drop zone - should see "URL dropped!" toast
- [ ] **Auto-dismiss**: Toast should disappear after 3 seconds
- [ ] **Visual Check**: Toast appears bottom-right with icon and message

**Notes:**
```

```

---

## 2. Export History (JSON/CSV)

### Test Cases:
- [ ] **Open History**: Click the clock icon (🕐) next to logo
- [ ] **Export JSON**: Click "Export JSON" button - file downloads
- [ ] **Export CSV**: Click "Export CSV" button - file downloads
- [ ] **JSON Format**: Open exported JSON - should contain history array with id, type, title, timestamp
- [ ] **CSV Format**: Open exported CSV - should have Date, Type, Title, Details columns
- [ ] **File Naming**: Files named `sarcastic-music-history-YYYY-MM-DD.json/csv`

**Notes:**
```

```

---

## 3. Drag & Drop URLs

### Test Cases:
- [ ] **KeyFinder**: Drag YouTube URL from browser into file drop zone
- [ ] **BpmFinder**: Drag SoundCloud URL into file drop zone
- [ ] **VoiceRemover**: Drag URL into file drop zone
- [ ] **Downloader**: Drag URL into input area
- [ ] **Visual Feedback**: Gold overlay appears when dragging URL
- [ ] **Auto-Platform**: Platform auto-selects based on URL domain
- [ ] **Toast**: "URL dropped!" toast appears

**Notes:**
```

```

---

## 4. Recent Files Tracking

### Test Cases:
- [ ] **Track File**: Upload audio file to KeyFinder
- [ ] **Check Storage**: Open DevTools → Application → Local Storage → `sarcastic_recent_files`
- [ ] **File Info**: Should contain name, type, size, timestamp, tool
- [ ] **Multiple Files**: Upload multiple files - should track all
- [ ] **Limit**: Check if max 10 recent files enforced

**Notes:**
```

```

---

## 5. Copy to Clipboard

### Test Cases:
- [ ] **KeyFinder Copy**: After analysis, click "Copy Key" button
- [ ] **Paste Test**: Paste clipboard - should be format like "C# Major"
- [ ] **BpmFinder Copy**: After analysis, click "Copy BPM" button
- [ ] **Paste Test**: Paste clipboard - should be format like "128 BPM"
- [ ] **Success Toast**: "Copied to clipboard!" toast appears

**Notes:**
```

```

---

## 6. Share Links / URL Parameters

### Test Cases:
- [ ] **URL Updates**: Navigate to RhymeFinder, search "hello" - URL should show `?tool=rhyme&word=hello`
- [ ] **Share Link**: Copy browser URL after searching
- [ ] **New Tab Test**: Paste URL in new tab - should load RhymeFinder with "hello" pre-filled
- [ ] **KeyFinder URL**: Analyze URL in KeyFinder, copy URL, open new tab
- [ ] **Downloader URL**: Enter URL in Downloader, copy browser URL, open new tab
- [ ] **State Restoration**: Tool + URL + Platform all restore correctly

**Notes:**
```

```

---

## 7. Clickable History Items

### Test Cases:
- [ ] **History Arrow**: History items show arrow (►) when they have data
- [ ] **Click History Item**: Click a history item - should navigate to that tool
- [ ] **Restore State**: Click download history - should go to Downloader with URL filled
- [ ] **Delete Works**: Click X on history item - should delete without navigating

**Notes:**
```

```

---

## 8. UrlDropZone Component

### Test Cases:
- [ ] **Accepts URLs**: Component recognizes URL drags
- [ ] **Accepts Files**: Component still accepts file drops
- [ ] **Visual Overlay**: Gold dashed border appears on drag
- [ ] **Link Icon**: Shows link icon in overlay
- [ ] **Text Update**: "Drop URL here" text appears

**Notes:**
```

```

---

## 9. History Data Structure

### Test Cases:
- [ ] **Type Field**: Each history item has type (rhyme_search, download, etc.)
- [ ] **Data Field**: Items store tool, url, platform, word, fileName
- [ ] **Title Field**: Short display title
- [ ] **Details Field**: Extra info ("MP3 from YouTube", "Key: C Major")
- [ ] **Timestamp**: Each item has timestamp for sorting

**Notes:**
```

```

---

## 10. Component Integration

### Test Each Component Has:
- [ ] **KeyFinder**: UrlDropZone, Toast, Copy buttons, History tracking, Recent files
- [ ] **BpmFinder**: UrlDropZone, Toast, Copy buttons, History tracking, Recent files
- [ ] **VoiceRemover**: UrlDropZone, Toast, History tracking, Recent files
- [ ] **Downloader**: UrlDropZone, Toast, History tracking
- [ ] **RhymeFinder**: Toast, History tracking, URL params sync

**Notes:**
```

```

---

## Known Issues / Limitations

- [ ] **YouTube Bot Detection**: External yt-dlp issue - can't fix
- [ ] **Mobile Drag-Drop**: May not work on touch devices
- [ ] **TypeScript Warnings**: Initial props may show lint errors (runtime works)

---

## Summary

**Total Features Tested:** ___ / 10
**Issues Found:** ___
**Working Perfectly:** ___

**Overall Status:** ⬜ All Good | ⬜ Minor Issues | ⬜ Major Issues

**Date Tested:** ___________
**Tester:** ___________
