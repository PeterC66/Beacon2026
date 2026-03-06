# Beacon2 — Deployment Guide (Proof of Concept)

This guide gets Beacon2 live on the internet using free hosting.
No command line or server knowledge needed — everything is done through websites.

---

## What you'll use

| Purpose        | Service  | Cost |
|----------------|----------|------|
| Backend & database | Render   | Free |
| Frontend (UI)  | Vercel   | Free |

---

## Step 1 — Push the code to GitHub

If you haven't already:

1. Go to github.com and create a new repository called `beacon2` (private is fine)
2. Upload or push the Beacon2 code into it
3. Make sure `render.yaml` is in the root of the repo and `vercel.json` is inside the `frontend` folder

---

## Step 2 — Deploy the backend and database (Render)

1. Go to **render.com** and sign up with your GitHub account
2. Click **New → Blueprint**
3. Connect your `beacon2` GitHub repository
4. Render will find the `render.yaml` file and set everything up automatically
5. It will ask you to fill in three values — click each one and enter:
   - `JWT_ACCESS_SECRET` — go to **generate-secret.vercel.app/64**, copy the result, paste it here
   - `JWT_REFRESH_SECRET` — go to the same site again (refresh the page for a new one), paste it here
   - `CORS_ORIGIN` — leave this blank for now, you'll fill it in after Step 3
6. Click **Apply** — Render will now build and start your backend (takes 2–3 minutes)
7. Once it's running, click on the `beacon2-backend` service and copy the URL shown at the top
   (it will look like `https://beacon2-backend-xxxx.onrender.com`)

---

## Step 3 — Set up the database tables (one time only)

1. In Render, go to your `beacon2-backend` service
2. Click the **Shell** tab at the top
3. Type this and press Enter:
   ```
   npx prisma migrate deploy
   ```
4. Wait for it to finish, then type:
   ```
   node src/seed/index.js
   ```
   This creates your first system administrator account and all the default data.
   Make a note of the email and password it prints out.

---

## Step 4 — Deploy the frontend (Vercel)

1. Go to **vercel.com** and sign up with your GitHub account
2. Click **Add New → Project**
3. Find your `beacon2` repository and click **Import**
4. Under **Root Directory**, click Edit and type: `frontend`
5. Under **Environment Variables**, add one entry:
   - Name: `VITE_API_URL`
   - Value: paste the Render backend URL you copied in Step 2
6. Click **Deploy** — Vercel builds and publishes the frontend (takes about 1 minute)
7. Once done, copy the Vercel URL (looks like `https://beacon2-xxxx.vercel.app`)

---

## Step 5 — Tell the backend about the frontend

This is the `CORS_ORIGIN` value you left blank earlier.

1. Go back to Render, open the `beacon2-backend` service
2. Click **Environment** in the left menu
3. Find `CORS_ORIGIN` and paste your Vercel URL (from Step 4)
4. Click **Save Changes** — the backend will restart automatically

---

## Step 6 — Test it

Open your Vercel URL in a browser. You should see the Beacon2 login screen.

Log in using the system administrator credentials printed in Step 3.

---

## Limitations of the free POC setup

These are all fine for a proof of concept — just be aware:

- **Render free tier sleeps** after 15 minutes of inactivity. The first request after a quiet
  period takes about 30 seconds. This won't happen in production (paid tier stays awake).
- **Redis is disabled** — if you change someone's role, their old session stays valid
  until their 15-minute token expires naturally. Acceptable for a POC.
- **Database size** is limited to 1GB on the free tier. More than enough for a POC.

---

## When you're ready to move beyond POC

Three things to do:

1. Upgrade Render to the **Starter** plan (~£6/month each for backend and database)
   to remove the sleep behaviour and get a proper backup schedule
2. Add **Upstash Redis** (free tier) and set `USE_REDIS=true` and `REDIS_URL` in Render
3. Buy a domain name and point it at Render and Vercel

---

## Getting help

If anything goes wrong, the Render and Vercel dashboards both show logs in real time.
In Render, click your service then click **Logs**. In Vercel, click your project then **Functions** or **Deployments**.
