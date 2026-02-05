# FitMentor - Serverless Fitness Application

**[View Live Demo](https://fitmentor-website-6.s3.us-east-1.amazonaws.com/FitMentor/Html/index.html)**

## 📖 Overview

FitMentor is a robust **serverless web application** designed to help users manage their fitness journey. It provides a comprehensive platform for tracking workouts, monitoring progress, and managing personal training goals.

This project was built to demonstrate a **cloud-native architecture** using **AWS** serverless technologies. It focuses on scalability, security, and low operational overhead by leveraging managed services instead of traditional servers.

![Creation of the Program](https://i.imgur.com/jeMCwGN.png)
![The program & chat](https://i.imgur.com/8zBhXMY.png)

## 🛠 Tech Stack

### Frontend
*   **HTML5 / CSS3 / JavaScript (Vanilla)**: Lightweight and responsive UI without heavy frameworks.
*   **AWS S3**: Static website hosting for the client-side application.

### Backend & Cloud Infrastructure (AWS)
*   **AWS Lambda (Node.js)**: Serverless compute functions handling business logic (Dashboard, Training Logs, Progress).
*   **Amazon API Gateway**: REST API acting as the secure entry point for the backend.
*   **Amazon DynamoDB**: NoSQL database for high-performance data storage (Single Table Design).
*   **Amazon Cognito**: Secure user authentication (Sign-up, Sign-in, Password Reset).
*   **AWS SAM (Serverless Application Model)**: Infrastructure as Code (IaC) for defining and deploying the stack.

## 🏗 Cloud Architecture

The application follows a purely serverless microservices pattern:

1.  **Client**: The static frontend is hosted on **S3** and interacts with the backend via REST APIs.
2.  **API Layer**: **API Gateway** routes requests to specific Lambda functions.
3.  **Compute**: **AWS Lambda** executes logic for authentication, data retrieval, and updates.
4.  **Data**: **DynamoDB** stores user profiles, workout sessions, and progress metrics.
5.  **Auth**: **Cognito** manages user pools and JWT tokens for secure API access.

---

## 📦 Installation & Deployment Guide

1. Prerequisites

-   AWS Account
-   IAM Role with permissions for: CloudFormation, Lambda, API Gateway,
    DynamoDB, Cognito, IAM:PassRole
-   AWS CLI installed and configured: aws configure
-   AWS SAM CLI installed

2. Open your AWS Environment

3.  Upload the project ZIP to AWS CloudShell and      extract it: unzip
    Fitmentor.zip cd Fitmentor/infrastructure

4.  Find your IAM Role ARN: AWS Console → IAM → Roles → Copy the ARN of
    your role (for example: LabRole)

5.  Deploy using SAM:
    sam deploy --guided --parameter-overrides LabRoleArn=arn:aws:iam::<ARN_NUMBER>:role/<ROLE_NAME>
    FULL Example (Not Real): sam deploy --guided --parameter-overrides LabRoleArn=arn:aws:iam::<YOUR_ACCOUNT_ID>:role/LabRole
    Stack name: FitMentorStack 
    Region: us-east-1 (or your preferred region)
    Parameter StageName: prod
    Parameter ResetUrlBase: 
    Parameter FitMentorTable: FitMentorData
    Parameter GoogleApiKey1: (your API key)
    Parameter GoogleApiKey2: (your API key)
    Parameter GoogleApiKey3: (your API key)
    Parameter LabRoleArn: (your role ARN)
    Confirm changes before deploy: Y
    Allow IAM role creation: Y 
    Disable rollback: N
    FitMentorLogicFunction has no authentication. Is this okay?: y
    FitMentorDashboardFunction has no authentication. Is this okay?: y
    FitMentorProgressFunction has no authentication. Is this okay?: y
    FitMentorTrainingLogFunction has no authentication. Is this okay?: y
    Save arguments to configuration file: n
    Deploy this changeset?: y

6. Get Deployment Outputs

    Go to CloudFormation → FitMentorStack → Outputs and copy and save:

-   ApiInvokeUrl
-   UserPoolId
-   UserPoolClientId

7. Frontend Configuration

In the frontend JavaScript files:

Functional.js: Set the hardcoded const API_BASE_URL ='<ApiInvokeUrl>';

admin.js: Replace hardcoded API_FALLBACK = '<ApiInvokeUrl>/API'

8. Hosting Frontend (S3 Static Website)

9.  Create or use an S3 bucket for the frontend.

10. Allow public access (or use CloudFront if private).

11.  Upload all HTML/JS/CSS files.

12. Enable Static Website Hosting in the S3 bucket:

    -   Index document: index.html

13. Add this policy to your S3 bucket:
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<YourBucketName>/*"
        }
    ]
}

14. Open the Bucket Website Endpoint – this is your application URL.

15.  Cognito & Environment Variables

    Verify Lambda & Cognito environment variables:

-   COGNITO_USER_POOL_ID: <UserPoolId>>
-   COGNITO_CLIENT_ID: <Cognito Client ID>
-   TABLE_NAME: FitMentorData
-   RESET_URL_BASE: <the index.html URL> (frontend URL for password reset)
-   GOOGLE_API_KEY1: (your API key)
-   GOOGLE_API_KEY2: (your API key)
-   GOOGLE_API_KEY3: (your API key)

16. Go to Cognito -> User Pools -> Authentication methods -> Password policy -> Edit -> Tick Custom + Untick "Contains at least 1 special character" and "Contains at least 1 lowercase letter". Make sure "Contains at least 1 number" and "Contains at least 1 uppercase letter" are ticked. Save changes.

17. Go to Cognito -> Message templates -> Tick "Verification Message" -> Edit -> Change "Verification type" from "Code" to "Link".

Note: You can edit the "Email subject" and "Email Message" as you like, this is sending a confirmation link to the user's email upon registration.
Do not delete the "#" in the following: {##Verify Email##}, just change the "Verify Email" to hebrew or any other language. All of this is not required, this is only for customization of the email.

18. Go to Cognito -> Branding -> Domain -> Cognito domain -> Create domain -> The cognito domain prefix should start like this:
https://<your bucket name>
And press on Create Cognito domain

19. Go to Cognito -> App clients -> Choose the project's app client -> Login pages -> Managed login pages configuration -> Edit -> Allowed callback URLs -> Add callback URL -> the URL should be: https://<the index.html URL> (without the "#" in the end) -> Default redirect URL should be the same index.html URL -> Identity providers: choose "Cognito user pool" -> OAuth 2.0 grant types: Choose "Authorization code grant" -> OpenID Connect scopes: Choose "OpenID" and "Email" -> Save changes

20. Go to Cognito -> Extensions -> Add Lambda trigger -> Tick "Sign-up" -> Tick "Post confirmation trigger" -> Assign Lambda function: Choose "FitMentorLogic" -> Save changes.

21. Go to Cognito -> Extensions -> Add Lambda trigger -> Tick "Authentication" -> Tick "Post authentication trigger" -> Assign Lambda function: Choose "FitMentorLogic" -> Save changes.

22. Go to Cognito -> Branding -> Domain -> Edit -> Tick "Hosted UI" -> Save changes.

23. Final Validation

24.  Open the website.
25.  Register a new user.
26.  Confirm email.
27.  Login.
28.  Verify Admin and User groups, dashboard, progress, and training
    logs.
29. You are ready to go!