# Fix IAM Permissions for S3 Upload

## Problem
The IAM user doesn't have permission to upload files to S3 buckets. The error shows:
```
User: arn:aws:iam::799517508256:user/BoomGhoomS3UploadPolicy is not authorized to perform: s3:PutObject
```

## Solution

### Step 1: Identify Your IAM User

1. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "Users" in the left sidebar
3. Find your user (it might be named `BoomGhoomS3UploadPolicy` or something similar)
4. **Note the exact user name** (you'll need it later)

### Step 2: Create/Update the Policy

1. In IAM Console, click **"Policies"** in the left sidebar
2. Click **"Create policy"**
3. Click the **"JSON"** tab
4. Paste the following policy (replace bucket names if different):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowS3Upload",
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

5. Click **"Next"**
6. **Policy name**: `BoomGhoomS3UploadPolicy` (or your preferred name)
7. **Description**: "Allows upload, read, and delete operations on BoomGhoom S3 buckets"
8. Click **"Create policy"**

### Step 3: Attach Policy to Your IAM User

1. Go back to **"Users"** in IAM Console
2. Click on your IAM user (the one whose access keys you're using)
3. Click the **"Permissions"** tab
4. Click **"Add permissions"** → **"Attach policies directly"**
5. In the search box, type: `BoomGhoomS3UploadPolicy`
6. **Check the checkbox** next to your policy
7. Click **"Add permissions"** (or "Next" then "Add permissions")

### Step 4: Verify Permissions

Make sure your user has the policy attached. In the user's "Permissions" tab, you should see:
- `BoomGhoomS3UploadPolicy` listed under "Permissions policies"

### Step 5: Wait and Test

**Important**: AWS IAM permissions can take a few seconds to propagate. Wait 30-60 seconds, then test your upload again.

---

## Alternative: Quick Fix with AWS Managed Policy (Less Secure)

If you want to test quickly (not recommended for production):

1. Go to IAM → Users → Your User
2. Click "Add permissions" → "Attach policies directly"
3. Search for: `AmazonS3FullAccess`
4. Attach it
5. **Note**: This gives full access to ALL S3 buckets. Only use for testing!

---

## Verify Your Access Keys Are Correct

1. Make sure your `.env` file has the correct access keys for the IAM user you just updated:
   ```env
   AWS_ACCESS_KEY_ID=AKIA...  (should match the user)
   AWS_SECRET_ACCESS_KEY=...
   ```

2. The access keys must belong to the IAM user you just attached the policy to.

---

## Common Mistakes to Avoid

1. **Wrong User**: Make sure the access keys in `.env` belong to the user you attached the policy to
2. **Policy Not Attached**: The policy must be attached to the user (not just created)
3. **Wrong Bucket Names**: Make sure bucket names in the policy match your actual buckets exactly
4. **Missing Wildcard**: The `/*` suffix on bucket ARNs is required for object-level permissions

---

## Still Not Working?

If it still doesn't work after 1-2 minutes:

1. **Double-check bucket names** in your policy match exactly (case-sensitive)
2. **Verify the IAM user name** matches what's in the error message
3. **Check if there are multiple IAM users** - make sure you're using the right one
4. **Try creating new access keys** for the user and update your `.env` file


