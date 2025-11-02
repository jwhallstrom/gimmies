# AWS Permissions Fix for Amplify Deployment

## 🚨 Current Issue

Your AWS user `aws-gimmies-cli` doesn't have sufficient permissions to deploy Amplify apps.

**Error:**
```
User: arn:aws:iam::843755450607:user/aws-gimmies-cli is not authorized to perform: 
ssm:GetParameter on resource: arn:aws:ssm:us-east-1:843755450607:parameter/cdk-bootstrap/hnb659fds/version
```

---

## ✅ Solution: Add Required AWS Permissions

### **Option 1: Use AdministratorAccess (Quickest - Dev Only)**

⚠️ **For development only** - gives full AWS access

1. Go to **AWS IAM Console**: https://console.aws.amazon.com/iam/
2. Click **Users** → Find `aws-gimmies-cli`
3. Click **Add permissions** → **Attach policies directly**
4. Search for and select: `AdministratorAccess`
5. Click **Add permissions**

---

### **Option 2: Minimum Required Permissions (Production Ready)**

Create a custom policy with only what Amplify needs:

#### **Step 1: Create IAM Policy**

1. Go to **IAM Console** → **Policies** → **Create policy**
2. Switch to **JSON** tab
3. Paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "amplify:*",
        "cloudformation:*",
        "cognito-identity:*",
        "cognito-idp:*",
        "dynamodb:*",
        "appsync:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:UpdateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:CreatePolicy",
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:CreatePolicyVersion",
        "iam:DeletePolicyVersion",
        "iam:ListPolicyVersions",
        "lambda:*",
        "logs:*",
        "s3:*",
        "ssm:GetParameter",
        "ssm:PutParameter",
        "ssm:DeleteParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
        "sts:GetCallerIdentity",
        "cloudwatch:*",
        "events:*",
        "secretsmanager:*"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Click **Next**
5. Name it: `AmplifyFullDeploymentPolicy`
6. Click **Create policy**

#### **Step 2: Attach to User**

1. Go to **Users** → `aws-gimmies-cli`
2. **Add permissions** → **Attach policies directly**
3. Search for `AmplifyFullDeploymentPolicy`
4. Select it and click **Add permissions**

---

### **Option 3: Quick Fix - Just Add SSM Permission**

Minimal fix to get past current error (but you'll hit more permission errors later):

1. Go to **Users** → `aws-gimmies-cli`
2. **Add permissions** → **Attach policies directly**
3. Search for: `AmazonSSMReadOnlyAccess`
4. Also search for: `CloudFormationFullAccess`
5. Also search for: `AWSCloudFormationFullAccess`
6. Select all and click **Add permissions**

You'll likely need to add more permissions as deployment continues.

---

## 🎯 My Recommendation

**For Development (Right Now):**
- Use **Option 1** (AdministratorAccess) to get sandbox running quickly
- You can always tighten permissions later

**For Production (Before Launch):**
- Use **Option 2** (Custom Policy) with principle of least privilege
- Create separate IAM users for dev vs production

---

## 🔄 After Adding Permissions

Once permissions are added in AWS console:

```powershell
# No need to reconfigure AWS CLI - permissions update automatically
# Just run the sandbox command again:
npm run amplify:sandbox
```

---

## 📋 Verification

To check if permissions worked:

```powershell
# This should now succeed:
aws ssm get-parameter --name /cdk-bootstrap/hnb659fds/version --region us-east-1
```

---

## 🆘 Still Having Issues?

If you continue getting permission errors:

1. **Check the specific permission** mentioned in the error
2. **Add that service** to your IAM policy
3. Common services needed:
   - CloudFormation
   - SSM (Systems Manager)
   - IAM (for creating roles)
   - Cognito
   - DynamoDB
   - AppSync
   - Lambda
   - S3
   - CloudWatch Logs

---

## 🚀 Next Steps After Permissions Fixed

1. ✅ Run `npm run amplify:sandbox`
2. ✅ Wait ~5-10 minutes for deployment
3. ✅ Get OAuth redirect URLs from output
4. ✅ Configure Google OAuth
5. ✅ Test login flow

---

**Need help? Let me know which option you chose!** 🏌️‍♂️
