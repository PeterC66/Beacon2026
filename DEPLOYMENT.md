# Beacon2 — Deployment Guide (Proof of Concept)

This guide gets Beacon2 live on the internet using free hosting.
No command line or server knowledge needed — everything is done through websites.

---

## What you'll use

| Purpose               | Service | Cost |
|-----------------------|---------|------|
| Backend & database    | Render  | Free |
| Frontend (UI)         | Vercel  | Free |

---

## Before you start — prepare three secret values

You'll need these during setup. Get them ready now.

**JWT_ACCESS_SECRET and JWT_REFRESH_SECRET**
1. Go to **generate-secret.vercel.app/64** in your browser
2. Copy the string shown — this is your `JWT_ACCESS_SECRET`
3. Refresh the page to get a new string — this is your `JWT_REFRESH_SECRET`
4. Keep both somewhere safe (e.g. a text file) — you'll paste them into Render shortly

**SEED_ADMIN_PASSWORD**
This is the password you'll use to log in to Beacon2 for the first time.
Choose something secure and make a note of it.

---

## Step 1 — Push the code to GitHub

If you haven't already:

1. Go to github.com and create a new repository called `beacon2` (private is fine)
2. Upload the Beacon2 code into it
3. Make sure `render.yaml` is in the root of the repo and `vercel.json` is inside the `frontend` folder

---

## Step 2 — Deploy the backend and database (Render)

1. Go to **render.com** and sign up with your GitHub account
2. Click **New → Blueprint**
3. Connect your `beacon2` GitHub repository
4. Render will find the `render.yaml` file and show you a list of environment variables to fill in
5. Fill in the following — leave anything else as-is:

   | Variable | Value |
   |---|---|
   | `JWT_ACCESS_SECRET` | Paste the first secret from "Before you start" |
   | `JWT_REFRESH_SECRET` | Paste the second secret from "Before you start" |
   | `SEED_ADMIN_EMAIL` | The email address you want to log in with |
   | `SEED_ADMIN_PASSWORD` | The password you chose in "Before you start" |
   | `CORS_ORIGIN` | Leave blank for now — you'll fill this in after Step 4 |

6. Click **Apply** — Render will now build and start your backend (takes 3–5 minutes)

**What happens automatically on first start:**
- The database tables are created
- Your admin account is created using the email and password you provided above
- The app starts and is ready to use

7. Once it shows as **Live**, click on the `beacon2-backend` service and copy the URL at the top
   (it looks like `https://beacon2-backend-xxxx.onrender.com`)

---

## Step 3 — Deploy the frontend (Vercel)

1. Go to **vercel.com** and sign up with your GitHub account
2. Click **Add New → Project**
3. Find your `beacon2` repository and click **Import**
4. Under **Root Directory**, click Edit and type: `frontend`
5. Under **Environment Variables**, add one entry:
   - Name: `VITE_API_URL`
   - Value: paste the Render backend URL you copied in Step 2
6. Click **Deploy** — takes about 1 minute
7. Once done, copy the Vercel URL (looks like `https://beacon2-xxxx.vercel.app`)

---

## Step 4 — Tell the backend about the frontend

This step allows the backend to accept requests from the frontend.

1. Go back to **Render**, open the `beacon2-backend` service
2. Click **Environment** in the left menu
3. Find `CORS_ORIGIN` and paste your Vercel URL from Step 3
4. Click **Save Changes** — the backend restarts automatically (takes about a minute)

---

## Step 5 — Test it

Open your Vercel URL in a browser. You should see the Beacon2 login screen.

Log in using the email and password you set in Step 2.

---

## Limitations of the free POC setup

These are all fine for a proof of concept — just be aware:

- **Render free tier sleeps** after 15 minutes of inactivity. The first request after a quiet
  period can take 20–30 seconds to wake up. This is fine for a POC but would be
  resolved by upgrading to Render's Starter plan (~£6/month).
- **Redis is disabled** — if you change a user's role, their existing login session keeps
  its old permissions until their 15-minute token naturally expires. Fine for a POC.
- **Database size** is limited to 1GB on the free tier — more than enough for a POC.

---

## Troubleshooting

**The deploy failed on Render**
Click on the `beacon2-backend` service, then click the **Logs** tab. The error message
will be shown there. Copy it and share it — it will point directly to the problem.

**I can't log in**
Check that `CORS_ORIGIN` in Render exactly matches your Vercel URL — no trailing slash.
Also check that `VITE_API_URL` in Vercel exactly matches your Render backend URL.

**I've forgotten my admin password**
In Render, go to Environment, change `SEED_ADMIN_PASSWORD` to a new value, and save.
Then go to the `beacon2-backend` service and click **Manual Deploy → Deploy latest commit**.
The app will restart and, if no admin exists, create a new one. If one already exists,
delete the user record from the database first via Render's database dashboard.

---

## When you're ready to move beyond POC

Three things to do, in order:

1. Upgrade the Render `beacon2-backend` and `beacon2-db` services to the **Starter** plan
   (~£6/month each) — this removes the sleep behaviour and adds automated backups
2. Add **Upstash Redis** (free tier at upstash.com, EU region) and set
   `USE_REDIS=true` and `REDIS_URL` in Render's environment variables
3. Buy a domain name (e.g. at namecheap.com) and point it at your Render and Vercel URLs

