
# Fix Plan: WhatsApp Image and Attachment Support

## Problem Summary

When respondents send images or other attachments via WhatsApp, they don't appear in the chatbot. The webhook receives the media correctly but ignores it because:

1. The webhook only extracts text from `text` and `button` content types
2. Media URLs (`image.url`, `document.url`, etc.) are not captured
3. The database has `media_url` and `media_type` columns, but they're never populated
4. The chat UI only renders text content, not media

---

## Current Flow (Broken)

```text
Exotel sends image message
    ↓
content: { type: "image", image: { url: "..." } }
    ↓
parseExotelPayload() only checks text/button → body = ""
    ↓
Message with empty body is processed
    ↓
Condition fails: "if (normalizedMsg.type === 'inbound' && normalizedMsg.body)"
    ↓
Message is IGNORED - never stored
```

---

## Proposed Solution

### Phase 1: Update Webhook to Capture Media

Modify `parseExotelPayload()` in the webhook to:
- Extract media URLs from `image`, `document`, `video`, `audio`, `sticker` content types
- Set a placeholder body text for media messages (e.g., "[Image]", "[Document]")
- Return both the media URL and media type

**Content Types to Support:**

| Type | Exotel Structure | Media URL Path |
|------|------------------|----------------|
| image | `content.image.url` | Image URL |
| document | `content.document.url` | PDF/Doc URL |
| video | `content.video.url` | Video URL |
| audio | `content.audio.url` | Audio URL |
| sticker | `content.sticker.url` | Sticker URL |

### Phase 2: Store Media in Database

Update the webhook to populate:
- `media_url`: The Exotel S3 URL for the attachment
- `media_type`: The content type (image, document, video, audio, sticker)
- `message_content`: A placeholder like "[Image]" or the caption if provided

### Phase 3: Update Chat UI to Render Media

Modify `WhatsAppChatDialog.tsx` to:
- Fetch `media_url` and `media_type` from the query
- Render images inline with `<img>` tags
- Show document links as downloadable attachments
- Display appropriate icons for video/audio with clickable links

---

## Technical Implementation

### File 1: `supabase/functions/whatsapp-webhook/index.ts`

**Changes to Interface:**
```typescript
interface NormalizedMessage {
  // ... existing fields
  mediaUrl: string | null;      // NEW
  mediaType: string | null;     // NEW
}
```

**Changes to `parseExotelPayload()`:**
```typescript
// Extract media from different content types
let body = '';
let mediaUrl: string | null = null;
let mediaType: string | null = null;

const contentType = msg.content?.type;

if (contentType === 'text' && msg.content.text?.body) {
  body = msg.content.text.body;
} else if (contentType === 'button' && msg.content.button?.text) {
  body = msg.content.button.text;
} else if (contentType === 'image') {
  mediaUrl = msg.content.image?.url || null;
  mediaType = 'image';
  body = msg.content.image?.caption || '[Image]';
} else if (contentType === 'document') {
  mediaUrl = msg.content.document?.url || null;
  mediaType = 'document';
  body = msg.content.document?.caption || '[Document]';
} else if (contentType === 'video') {
  mediaUrl = msg.content.video?.url || null;
  mediaType = 'video';
  body = msg.content.video?.caption || '[Video]';
} else if (contentType === 'audio') {
  mediaUrl = msg.content.audio?.url || null;
  mediaType = 'audio';
  body = '[Audio]';
}
```

**Changes to inbound condition:**
```typescript
// Allow messages with either text body OR media
if (normalizedMsg.type === 'inbound' && (normalizedMsg.body || normalizedMsg.mediaUrl)) {
```

**Changes to database insert:**
```typescript
.insert({
  // ... existing fields
  media_url: normalizedMsg.mediaUrl,
  media_type: normalizedMsg.mediaType,
})
```

### File 2: `src/components/LOS/Relationships/WhatsAppChatDialog.tsx`

**Update interface and query:**
```typescript
interface WhatsAppMessage {
  // ... existing fields
  media_url: string | null;
  media_type: string | null;
}

// Add to select query
.select('id, direction, message_content, sent_at, status, phone_number, created_at, media_url, media_type')
```

**Add media rendering in the message bubble:**
```typescript
{/* Media content */}
{msg.media_url && (
  <div className="mb-2">
    {msg.media_type === 'image' ? (
      <img 
        src={msg.media_url} 
        alt="Shared image" 
        className="max-w-full rounded-lg cursor-pointer"
        onClick={() => window.open(msg.media_url, '_blank')}
      />
    ) : msg.media_type === 'document' ? (
      <a 
        href={msg.media_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-white/50 rounded"
      >
        <FileText className="h-5 w-5" />
        <span className="text-sm underline">View Document</span>
      </a>
    ) : (
      <a href={msg.media_url} target="_blank">
        View {msg.media_type}
      </a>
    )}
  </div>
)}

{/* Text content */}
{msg.message_content && !msg.message_content.startsWith('[') && (
  <p className="text-sm whitespace-pre-wrap">{msg.message_content}</p>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | Add media extraction and storage |
| `src/components/LOS/Relationships/WhatsAppChatDialog.tsx` | Add media rendering |

---

## Important Note on URL Expiry

The Exotel S3 URLs are **pre-signed and expire after 15 minutes**. For long-term storage:
- Consider downloading the media to your own storage (Lovable Cloud Storage)
- Or accept that old media links will expire (simpler approach for now)

This plan implements the simpler approach first - storing the URLs as-is. If media persistence is critical, a follow-up task can add media re-hosting.
