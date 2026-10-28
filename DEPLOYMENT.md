# Deployment Guide — Chainhub SFMS

This project is configured for production deployment using **Render** (Django Backend + PostgreSQL Database) and **Vercel** (React Frontend).

---

## 1. Push Your Code to GitHub

Open a terminal in the project root and run:

```bash
git init
git add .
git commit -m "Initial commit with production configuration"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

*(The `.gitignore` files are already configured to keep your `node_modules`, `db.sqlite3`, and sensitive `.env` files safe from being uploaded).*

---

## 2. Deploy the Backend & Database (Render.com)

You have two easy ways on Render:

### Option A: Using Blueprint (Automatic - Recommended)
1. Sign in to [Render.com](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository.
4. Render will read `render.yaml` and automatically configure:
   - A free **PostgreSQL Database** (`chainhub-db`)
   - A free **Web Service** (`chainhub-backend`) connected to the database
5. Add your email environment variables in the prompt:
   - `GMAIL_ADDRESS`: your Gmail address
   - `GMAIL_APP_PASSWORD`: your 16-character Google App Password
6. Click **Apply**.

### Option B: Manual Setup
1. **Create PostgreSQL Database**:
   - In Render, click **New +** → **PostgreSQL**.
   - Name: `chainhub-db`, Plan: `Free`.
   - Click **Create Database**.
   - Copy the **Internal Database URL**.
2. **Create Web Service**:
   - Click **New +** → **Web Service**.
   - Connect your GitHub repo.
   - **Root Directory**: `sfms_backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput
     ```
   - **Start Command**:
     ```bash
     gunicorn sfms_backend.wsgi:application
     ```
   - **Environment Variables**:
     | Key | Value | Notes |
     | :--- | :--- | :--- |
     | `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Connects persistent PostgreSQL |
     | `PYTHON_VERSION` | `3.11.9` | Ensures compatible Python environment |
     | `CORS_ALLOW_ALL` | `False` | Restricts API access to authorized frontend origins |
     | `CORS_ALLOWED_ORIGINS` | `https://<your-project>.vercel.app` | Your live Vercel frontend URL |
     | `CSRF_TRUSTED_ORIGINS` | `https://<your-project>.vercel.app` | CSRF protection for your live frontend |
     | `GMAIL_ADDRESS` | `your_email@gmail.com` | For sending OTP verification codes |
     | `GMAIL_APP_PASSWORD` | `your_16_digit_app_password` | Google 2FA App Password |

3. Once deployed, copy your live backend URL (e.g. `https://chainhub-backend.onrender.com`).

> **Create Admin User**: In the Render dashboard, open the **Shell** tab of your web service and run:
> ```bash
> python manage.py createsuperuser
> ```

---

## 3. Deploy the Frontend (Vercel)

1. Sign in to [Vercel.com](https://vercel.com).
2. Click **Add New…** → **Project**.
3. Select your GitHub repository.
4. In the setup screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and choose **`sfms_frontend`** (Crucial!)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Environment Variables**:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://chainhub-backend.onrender.com/api` *(Your Render backend URL + `/api`)* |

6. Click **Deploy**.
7. In ~30 seconds, your site will be live at `https://<your-project>.vercel.app`!

---

## 4. Verification

1. Open your Vercel URL.
2. Register a new Franchise Owner account (verify email OTP works).
3. Log in to the Owner Dashboard.
4. Log in to the Admin Dashboard (`/login` with your created superuser credentials).
