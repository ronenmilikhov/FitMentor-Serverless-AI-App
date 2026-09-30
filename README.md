# FitMentor

Serverless fitness web app: AI training plans, workout tracking, and progress — built as a cloud-native AWS project (no servers to manage).

Hebrew RTL UI. Auth with Amazon Cognito. Plans and chat via Gemini on AWS Lambda.

![Creation of the Program](https://i.imgur.com/jeMCwGN.png)
![The program & chat](https://i.imgur.com/8zBhXMY.png)

## What it does

- **Auth** — sign-up, email verification, login, password reset (Cognito)
- **AI coach** — generate a plan from goals, equipment, and available time; chat to adjust it (Gemini)
- **Training log** — save sets, reps, weights, and session history
- **Progress** — charts and AI insights from logged workouts
- **Admin** — Cognito `Admins` group: list users, block/unblock accounts

## Architecture

Static frontend on **S3** → **API Gateway** (REST, POST per resource) → **Lambda** → **DynamoDB** (single table). **Cognito** issues JWTs; API access is authorized in Lambda.

| Function | Role |
|---|---|
| `FitMentorLogic` | Auth, groups, admin APIs, Cognito post-confirm / post-auth |
| `FitMentorDashboard` | Plans, chat, Gemini |
| `FitMentorTrainingLog` | Workout log CRUD |
| `FitMentorProgress` | Progress metrics |
| `FitMentorCognitoCustomMessage` | Password-reset email (custom link back to the app) |

Infra is defined in `infrastructure/template.yaml` (AWS SAM). API contract: `api/openapi.yaml`.

## Tech stack

**Frontend:** HTML, CSS, vanilla JavaScript  
**Backend:** AWS Lambda (Node.js 20)  
**AWS:** API Gateway, DynamoDB, Cognito, S3, SAM / CloudFormation  
**AI:** Google Gemini (`FitMentorDashboard`)

## Repository

```
Html/            # Pages (home, dashboard, log, progress, admin)
Css/ JS/         # Styles and client logic
Lambda/          # One folder per function
infrastructure/  # SAM template
api/             # OpenAPI
config/          # env.example (no secrets)
```

Set the API invoke URL in `JS/Functional.js` (`API_BASE_URL`) and `JS/admin.js` (`API_FALLBACK`).

## Design notes

- **Single-table DynamoDB** — `UserID` (partition) + `DataType` (sort) for profiles, plans, logs, and metrics
- **Action routing** — one POST path per Lambda; `action` in the body selects the handler
- **Least custom servers** — managed auth, DB, and compute; IAM via an existing deploy role in SAM

Deploy with AWS SAM from `infrastructure/` (`LabRoleArn`, table name, Gemini keys, `ResetUrlBase`). After deploy, attach Cognito **Post confirmation** and **Post authentication** to `FitMentorLogic` (not in the template today).
