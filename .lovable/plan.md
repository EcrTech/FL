
# Feature Plan: Add WhatsApp Attachment/Image Sending

## Current State

The WhatsApp chat dialog currently only supports:
- **Receiving** images and attachments (just implemented)
- **Sending** text messages only

There is no UI for attaching files and no backend logic to upload and send media via Exotel's WhatsApp API.

---

## How Exotel Media Messages Work

To send media via WhatsApp through Exotel, you need to:
1. Host the media file on a **publicly accessible URL** (Exotel fetches it from this URL)
2. Send an API request with the media URL and type

**Exotel V2 API Media Payload:**
```json
{
  "whatsapp": {
    "messages": [{
      "from": "+91XXXXXXXXXX",
      "to": "91XXXXXXXXXX",
      "content": {
        "type": "image",
        "image": {
          "url": "https://your-bucket.supabase.co/storage/v1/object/public/...",
          "caption": "Optional caption text"
        }
      }
    }]
  }
}
```

Supported media types: `image`, `document`, `video`, `audio`

---

## Implementation Plan

### Phase 1: Create Storage Bucket for WhatsApp Media

Create a public storage bucket to host uploaded files so Exotel can access them.

**Database Migration:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

-- RLS policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Public read access (Exotel needs this)
CREATE POLICY "Public can view whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');
```

### Phase 2: Update Edge Function

Modify `send-whatsapp-message` to accept media uploads.

**New Request Parameters:**
```typescript
interface SendMessageRequest {
  // ... existing fields
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  mediaUrl?: string;       // Public URL of the uploaded file
  mediaCaption?: string;   // Optional caption
}
```

**New Payload Logic:**
```typescript
if (mediaUrl && mediaType) {
  exotelPayload = {
    whatsapp: {
      messages: [{
        from: whatsappSettings.whatsapp_source_number,
        to: phoneDigits,
        content: {
          type: mediaType,
          [mediaType]: {
            url: mediaUrl,
            caption: mediaCaption || undefined
          }
        }
      }]
    }
  };
}
```

**Store Media in Database:**
```typescript
.insert({
  // ... existing fields
  media_url: mediaUrl || null,
  media_type: mediaType || null,
})
```

### Phase 3: Update Chat UI

Add attachment button and upload flow to `WhatsAppChatDialog.tsx`.

**New UI Elements:**
- Paperclip/attachment button next to the send button
- Hidden file input for selecting files
- Upload progress indicator
- Image/file preview before sending

**File Upload Flow:**
```typescript
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // 1. Upload to Supabase Storage
  const filePath = `${contactId}/${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage
    .from('whatsapp-media')
    .upload(filePath, file);
  
  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('whatsapp-media')
    .getPublicUrl(filePath);
  
  // 3. Send via edge function with mediaUrl
  await supabase.functions.invoke('send-whatsapp-message', {
    body: {
      contactId,
      phoneNumber,
      mediaType: getMediaType(file.type),
      mediaUrl: publicUrl,
      mediaCaption: caption || undefined,
    },
  });
};
```

**Helper to determine media type:**
```typescript
const getMediaType = (mimeType: string): 'image' | 'document' | 'video' | 'audio' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};
```

**UI Changes:**
```tsx
<div className="flex items-center gap-2">
  <input
    type="file"
    ref={fileInputRef}
    onChange={handleFileSelect}
    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
    className="hidden"
  />
  <Button
    variant="ghost"
    size="icon"
    onClick={() => fileInputRef.current?.click()}
    disabled={!isSessionActive() || sending}
  >
    <Paperclip className="h-5 w-5" />
  </Button>
  <Input ... />
  <Button ...>
    <Send />
  </Button>
</div>
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Create `whatsapp-media` storage bucket with RLS policies |
| `supabase/functions/send-whatsapp-message/index.ts` | Add media URL and type handling in Exotel payload |
| `src/components/LOS/Relationships/WhatsAppChatDialog.tsx` | Add attachment button, file upload, and preview UI |

---

## Limitations

1. **File size**: Exotel/WhatsApp has limits (~16MB for most media, 100MB for documents)
2. **Session required**: Media can only be sent within the 24-hour session window (same as text)
3. **Processing time**: Large files may take a moment to upload before sending

---

## Technical Flow

```
1. User clicks attachment button
2. File picker opens
3. User selects image/document
4. File uploads to Supabase Storage (public bucket)
5. Public URL is generated
6. Edge function called with mediaUrl + mediaType
7. Exotel fetches media from URL and sends via WhatsApp
8. Message stored in database with media_url
9. UI updates to show sent media
```
