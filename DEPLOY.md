# Deploying Tashgheel Retail Online to Railway

This guide outlines the steps to deploy the application to [Railway.app](https://railway.app/).

## Prerequisites

- GitHub account
- Railway account
- MongoDB Connection String (Atlas or Railway Plugin)

## Environment Variables

Configure the following environment variables in your Railway project settings:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGO_URI` | Connection string for MongoDB | `mongodb+srv://...` |
| `JWT_SECRET` | Secret key for signing tokens | `mysecretkey` |
| `EMAIL_USER` | Email address for sending notifications | `admin@example.com` |
| `EMAIL_PASS` | App password for the email account | `xxxx xxxx xxxx xxxx` |
| `PORT` | (Optional) Port to run the server | `8080` (Railway sets this automatically) |

## Deployment Steps

1.  **Push to GitHub**:
    Run the following commands in your terminal (PowerShell or CMD) inside the `D:\Tashgheel Modules Source Code\Tashgheel Retail Online` folder:

    ```bash
    git init
    git add .
    git commit -m "Prepare for Railway deployment: Remove license check, update config"
    git branch -M main
    git remote remove origin
    git remote add origin https://github.com/itqansolutions/TashgheelRestaurantsOnline.git
    git push -u origin main
    ```

2.  **Create Service on Railway**:
    - Login to Railway.
    - Click "New Project" -> "Deploy from GitHub repo".
    - Select the repository `Tashgheel Retail Online`.

3.  **Configure Variables**:
    - Go to the "Variables" tab in your new service.
    - Add the variables listed above.

4.  **Verify Build**:
    - Railway should automatically detect `package.json` and run `npm install` and `npm start`.
    - Check the "Deployments" tab for logs.

5.  **Domain**:
    - Go to "Settings" -> "Networking" -> "Generate Domain" to get a public URL.

## Troubleshooting

- **Build Fails**: Ensure `package.json` has the correct `start` script: `"start": "node server/index.js"`.
- **Database Connection Error**: Verify `MONGO_URI` includes the correct credentials and database name.
