# AWS S3 Setup Guide for BoomGhoom Backend

This guide provides step-by-step instructions for setting up AWS S3 buckets for image uploads in the BoomGhoom backend application.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create AWS Account](#step-1-create-aws-account)
3. [Step 2: Create S3 Buckets](#step-2-create-s3-buckets)
4. [Step 3: Configure Bucket Permissions](#step-3-configure-bucket-permissions)
5. [Step 4: Create IAM User and Get Credentials](#step-4-create-iam-user-and-get-credentials)
6. [Step 5: Configure Backend Environment Variables](#step-5-configure-backend-environment-variables)
7. [Step 6: Test the Upload API](#step-6-test-the-upload-api)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- An AWS account (free tier is sufficient for testing)
- Basic knowledge of AWS S3 and IAM
- Access to your backend project's `.env` file

---

## Step 1: Create AWS Account

If you don't have an AWS account:

1. Go to [AWS Sign Up](https://portal.aws.amazon.com/billing/signup)
2. Follow the registration process
3. Verify your email and phone number
4. Add a payment method (free tier includes 5GB S3 storage for 12 months)

---

## Step 2: Create S3 Buckets

You need to create three separate buckets for different types of uploads:

### Bucket 1: Event Images

1. **Log in to AWS Console**
   - Go to [AWS Console](https://console.aws.amazon.com/)
   - Sign in with your credentials

2. **Navigate to S3**
   - Search for "S3" in the search bar
   - Click on "S3" service

3. **Create Bucket**
   - Click "Create bucket" button
   - **Bucket name**: `boomghoom-events` (or your preferred name, must be globally unique)
   - **AWS Region**: Select `ap-south-1` (Mumbai) or your preferred region
   - **Object Ownership**: Select "ACLs enabled" and "Bucket owner preferred"
   - **Block Public Access**: **UNCHECK** "Block all public access" (we need public read access)
     - Check the acknowledgment box
   - **Bucket Versioning**: Disable (optional)
   - **Default encryption**: Enable (recommended)
   - **Bucket Key**: Enable (recommended)
   - Click "Create bucket"

### Bucket 2: Document Images

1. Repeat the same process with:
   - **Bucket name**: `boomghoom-documents` (must be globally unique)
   - **AWS Region**: Same as event bucket (`ap-south-1`)
   - **Block Public Access**: **UNCHECK** (same as above)

### Bucket 3: Profile Images

1. Repeat the same process with:
   - **Bucket name**: `boomghoom-profiles` (must be globally unique)
   - **AWS Region**: Same as event bucket (`ap-south-1`)
   - **Block Public Access**: **UNCHECK** (same as above)

---

## Step 3: Configure Bucket Permissions

For each bucket (event, document, profile), configure the following:

### 3.1 Enable CORS (Cross-Origin Resource Sharing)

1. Select your bucket (e.g., `boomghoom-events`)
2. Go to "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit"
5. Add the following CORS configuration:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

6. Click "Save changes"
7. **Repeat for all three buckets**

### 3.2 Configure Bucket Policy (Public Read Access)

1. Still in the "Permissions" tab
2. Scroll to "Bucket policy"
3. Click "Edit"
4. Add the following policy (replace `YOUR_BUCKET_NAME` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        },
        {
            "Sid": "AllowUpload",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER_NAME"
            },
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```

**Note**: You'll need to:
- Replace `YOUR_BUCKET_NAME` with your actual bucket name
- Replace `YOUR_ACCOUNT_ID` with your AWS account ID (found in top-right corner of AWS Console)
- Replace `YOUR_IAM_USER_NAME` with the IAM user you'll create in Step 4

**Important**: Wait until Step 4 to complete this step, as you need the IAM user name first. For now, you can use this simpler policy for testing:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
        }
    ]
}
```

5. Click "Save changes"
6. **Repeat for all three buckets**

---

## Step 4: Create IAM User and Get Credentials

### 4.1 Create IAM User

1. **Navigate to IAM**
   - Search for "IAM" in AWS Console
   - Click on "IAM" service

2. **Create User**
   - Click "Users" in the left sidebar
   - Click "Create user"
   - **User name**: `boomghoom-s3-uploader` (or your preferred name)
   - Select "Provide user access to the AWS Management Console" (optional)
   - Click "Next"

3. **Set Permissions**
   - Select "Attach policies directly"
   - Click "Create policy"
   - Switch to "JSON" tab
   - Paste the following policy (replace bucket names with your actual bucket names):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::boomghoom-events",
                "arn:aws:s3:::boomghoom-events/*",
                "arn:aws:s3:::boomghoom-documents",
                "arn:aws:s3:::boomghoom-documents/*",
                "arn:aws:s3:::boomghoom-profiles",
                "arn:aws:s3:::boomghoom-profiles/*"
            ]
        }
    ]
}
```

   - Click "Next"
   - **Policy name**: `BoomGhoomS3UploadPolicy`
   - Click "Create policy"

4. **Attach Policy to User**
   - Go back to the "Create user" page
   - Refresh the policies list
   - Search for `BoomGhoomS3UploadPolicy`
   - Select it
   - Click "Next"
   - Review and click "Create user"

### 4.2 Create Access Keys

1. **Select the user** you just created (`boomghoom-s3-uploader`)
2. Go to "Security credentials" tab
3. Scroll to "Access keys"
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Check the confirmation box
7. Click "Next"
8. Optionally add a description
9. Click "Create access key"

### 4.3 Save Credentials

**⚠️ IMPORTANT: Save these credentials immediately!**

You'll see:
- **Access key ID**: `AKIA...` (starts with AKIA)
- **Secret access key**: `...` (long string)

**Copy both values and save them securely.** You won't be able to see the secret access key again.

---

## Step 5: Configure Backend Environment Variables

1. **Open your backend project**
2. **Locate `.env` file** (create one if it doesn't exist in the root directory)
3. **Add the following environment variables**:

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_secret_access_key_here

# AWS Region
AWS_REGION=ap-south-1

# S3 Bucket Names
AWS_S3_BUCKET_EVENT=boomghoom-events
AWS_S3_BUCKET_DOCUMENT=boomghoom-documents
AWS_S3_BUCKET_PROFILE=boomghoom-profiles

# Optional: Default bucket (for backward compatibility)
AWS_S3_BUCKET=boomghoom-assets
```

4. **Replace the values** with your actual:
   - Access Key ID (from Step 4.3)
   - Secret Access Key (from Step 4.3)
   - Bucket names (must match exactly what you created)

5. **Save the file**

---

## Step 6: Test the Upload API

### 6.1 Start Your Backend Server

```bash
npm run dev
# or
npm start
```

### 6.2 Test with cURL or Postman

**Endpoint**: `POST /api/v1/upload`

**Headers**:
- `Authorization: Bearer YOUR_JWT_TOKEN`
- `Content-Type: multipart/form-data`

**Body** (form-data):
- `file`: (file) Your image file
- `bucketType`: (query parameter) `event`, `document`, or `profile`

**Example cURL command**:

```bash
curl -X POST \
  'http://localhost:3000/api/v1/upload?bucketType=event' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -F 'file=@/path/to/your/image.jpg'
```

**Expected Response**:

```json
{
    "success": true,
    "data": {
        "url": "https://boomghoom-events.s3.ap-south-1.amazonaws.com/event/user123/uuid-filename.jpg",
        "key": "event/user123/uuid-filename.jpg",
        "bucket": "boomghoom-events",
        "fileName": "filename.jpg",
        "fileSize": 123456,
        "mimeType": "image/jpeg"
    }
}
```

### 6.3 Test with Postman

1. Create a new POST request
2. URL: `http://localhost:3000/api/v1/upload?bucketType=event`
3. Authorization: Bearer Token (add your JWT token)
4. Body → form-data:
   - Key: `file` (select "File" type)
   - Value: Choose your image file
5. Send request

---

## API Usage for Frontend Developers

### Endpoint
```
POST /api/v1/upload?bucketType={event|document|profile}
```

### Authentication
Requires JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Request
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Query Parameter**: `bucketType` (required)
  - `event` - Uploads to event bucket
  - `document` - Uploads to document bucket
  - `profile` - Uploads to profile bucket
- **Body**:
  - `file` (required): Image file (JPEG, PNG, WebP for images; PDF allowed for documents)
  - Max file size: 10MB for documents, 5MB for images

### Response

**Success (200)**:
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

**Error (400)**:
```json
{
    "success": false,
    "error": {
        "message": "Invalid file type. Allowed types for event: image/jpeg, image/png, image/webp",
        "code": "BAD_REQUEST"
    }
}
```

### Example Frontend Code (JavaScript/React)

```javascript
const uploadImage = async (file, bucketType) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(
    `${API_BASE_URL}/api/v1/upload?bucketType=${bucketType}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    }
  );
  
  const result = await response.json();
  if (result.success) {
    console.log('Image URL:', result.data.url);
    return result.data.url;
  } else {
    throw new Error(result.error.message);
  }
};

// Usage
const imageUrl = await uploadImage(fileInput.files[0], 'event');
```

---

## Troubleshooting

### Issue: "Access Denied" Error

**Solution**:
1. Verify IAM user has correct permissions
2. Check bucket policy allows your IAM user
3. Ensure access keys are correct in `.env`

### Issue: "Bucket does not exist"

**Solution**:
1. Verify bucket names in `.env` match exactly with AWS S3 buckets
2. Check AWS region is correct
3. Ensure buckets are created in the same region

### Issue: "Block Public Access" Error

**Solution**:
1. Go to S3 bucket → Permissions tab
2. Click "Edit" on "Block public access"
3. Uncheck all options
4. Save changes

### Issue: CORS Error in Browser

**Solution**:
1. Verify CORS configuration in bucket settings
2. Ensure `AllowedOrigins` includes your frontend domain
3. Check `AllowedMethods` includes `PUT` and `POST`

### Issue: File Upload Fails Silently

**Solution**:
1. Check backend logs for errors
2. Verify file size is within limits (5MB images, 10MB documents)
3. Ensure file type is allowed (JPEG, PNG, WebP for images)
4. Check network connectivity to AWS

### Issue: Image URL Not Accessible

**Solution**:
1. Verify bucket policy allows public read access
2. Check object ACL is set to "public-read"
3. Ensure bucket CORS is configured correctly

---

## Security Best Practices

1. **Never commit `.env` file** to version control
2. **Rotate access keys** periodically (every 90 days recommended)
3. **Use least privilege principle** - only grant necessary permissions
4. **Enable S3 bucket logging** for audit trails
5. **Enable versioning** for important buckets (optional)
6. **Use bucket policies** instead of making everything public when possible
7. **Enable MFA** on AWS root account
8. **Monitor AWS CloudTrail** for access logs

---

## Cost Considerations

AWS S3 Free Tier includes:
- 5 GB of standard storage
- 20,000 GET requests
- 2,000 PUT requests

After free tier:
- Storage: ~$0.023 per GB/month
- PUT requests: ~$0.005 per 1,000 requests
- GET requests: ~$0.0004 per 1,000 requests

**Tips to minimize costs**:
- Delete old/unused images
- Use S3 Lifecycle policies to archive old files
- Enable S3 Intelligent-Tiering
- Compress images before upload

---

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [S3 Pricing](https://aws.amazon.com/s3/pricing/)
- [S3 CORS Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)

---

## Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Review backend application logs
3. Verify all environment variables are set correctly
4. Test with AWS CLI to isolate backend issues

---

**Last Updated**: 2024
**Version**: 1.0

