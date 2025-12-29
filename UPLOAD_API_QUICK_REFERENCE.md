# Upload API Quick Reference

## Endpoint
```
POST /api/v1/upload?bucketType={event|document|profile}
```

## Authentication
Requires JWT token:
```
Authorization: Bearer <your_jwt_token>
```

## Request Format
- **Content-Type**: `multipart/form-data`
- **Query Parameter**: `bucketType` (required)
  - `event` - Uploads to event images bucket
  - `document` - Uploads to documents bucket  
  - `profile` - Uploads to profile images bucket
- **Body Field**: `file` (required)
  - Image files: JPEG, PNG, WebP
  - Documents: JPEG, PNG, PDF
  - Max size: 5MB (images), 10MB (documents)

## Response Format

### Success Response (200)
```json
{
    "success": true,
    "data": {
        "url": "https://boomghoom-events.s3.ap-south-1.amazonaws.com/event/user123/uuid-image.jpg",
        "key": "event/user123/uuid-image.jpg",
        "bucket": "boomghoom-events",
        "fileName": "image.jpg",
        "fileSize": 123456,
        "mimeType": "image/jpeg"
    }
}
```

### Error Response (400/401/500)
```json
{
    "success": false,
    "error": {
        "message": "Error message here",
        "code": "ERROR_CODE"
    }
}
```

## Frontend Example (JavaScript)

```javascript
async function uploadImage(file, bucketType) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(
    `http://your-api-url/api/v1/upload?bucketType=${bucketType}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${yourJwtToken}`
      },
      body: formData
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    return result.data.url; // Use this URL in your app
  } else {
    throw new Error(result.error.message);
  }
}

// Usage
const imageUrl = await uploadImage(fileInput.files[0], 'event');
```

## cURL Example

```bash
curl -X POST \
  'http://localhost:3000/api/v1/upload?bucketType=event' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F 'file=@/path/to/image.jpg'
```

## Environment Variables Required

```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
AWS_S3_BUCKET_EVENT=boomghoom-events
AWS_S3_BUCKET_DOCUMENT=boomghoom-documents
AWS_S3_BUCKET_PROFILE=boomghoom-profiles
```

## For Complete Setup Instructions
See `AWS_S3_SETUP_GUIDE.md`

