# Smart Franchise Management System — Module 1: Login & Roles + Outlet Onboarding

This is the working backend for Module 1 of your final year project.
It has been built and tested — you can run it exactly as-is.

## What's included in this module

- Custom User model with 3 roles: `admin`, `franchise_owner`, `staff`
- Franchise Owner registration (public sign-up)
- JWT-based login (access token + refresh token)
- Outlet onboarding (franchise owner submits outlet info)
- Admin approval/rejection of outlets
- Role-based permissions (only Admin can approve outlets)
- Django Admin panel (to view/manage everything visually)
- **Module 3 — Sales Entry & Analytics:** daily sales logging, sales history, and auto-calculated summary stats (today's sales, monthly total, average daily, growth % vs last month, best/worst day)

## How to run this on your computer

### 1. Install Python packages
```bash
cd sfms_backend
pip install -r requirements.txt
```

### 2. Create the database tables
```bash
python manage.py makemigrations accounts
python manage.py migrate
```

### 3. Create your Admin (HQ) account
```bash
python manage.py shell -c "from accounts.models import User; User.objects.create_superuser(username='admin', email='admin@smartfranchise.com', password='Admin@12345', role='admin')"
```

### 4. Run the server
```bash
python manage.py runserver
```

Server will start at: `http://127.0.0.1:8000/`

Django Admin panel (visual view of your database): `http://127.0.0.1:8000/admin/`
Login with username `admin` and password `Admin@12345`

## API Endpoints (test these with Postman, Thunder Client, or curl)

| Method | Endpoint | Who can access | What it does |
|---|---|---|---|
| POST | `/api/register/` | Public | Register a new Franchise Owner |
| POST | `/api/login/` | Public | Login, returns `access` + `refresh` JWT tokens |
| POST | `/api/login/refresh/` | Public | Get a new access token using refresh token |
| GET | `/api/profile/` | Logged-in user | Get your own profile info |
| POST | `/api/outlets/create/` | Logged-in Franchise Owner | Submit outlet for onboarding |
| GET | `/api/outlets/` | Logged-in user | Admin sees all outlets, Owner sees only their own |
| PATCH | `/api/outlets/<id>/approve/` | Admin only | Approve or reject an outlet |
| POST | `/api/sales/create/` | Approved Franchise Owner | Log today's sales (or a specific date) |
| GET | `/api/sales/` | Logged-in user | Owner sees own sales; Admin sees all (filter with `?outlet=<id>`) |
| GET | `/api/sales/summary/` | Logged-in user | Owner gets their stats; Admin gets per-outlet breakdown for all outlets |

### Example: Register a Franchise Owner
```bash
curl -X POST http://127.0.0.1:8000/api/register/ \
  -H "Content-Type: application/json" \
  -d '{"username":"rajesh_kumar","email":"rajesh@quickbite.com","password":"Test@1234"}'
```

### Example: Login
```bash
curl -X POST http://127.0.0.1:8000/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"rajesh_kumar","password":"Test@1234"}'
```
This returns an `access` token — copy it, you need it for the next requests.

### Example: Create an outlet (replace YOUR_TOKEN)
```bash
curl -X POST http://127.0.0.1:8000/api/outlets/create/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"outlet_name":"QuickBite - Ludhiana","city":"Ludhiana","address":"Model Town Market"}'
```

### Example: Admin approves the outlet (replace YOUR_ADMIN_TOKEN and <id>)
```bash
curl -X PATCH http://127.0.0.1:8000/api/outlets/1/approve/ \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'
```

## Project structure explained

```
sfms_backend/
├── manage.py                  # Django's command-line tool
├── requirements.txt           # Python packages needed
├── sfms_backend/
│   ├── settings.py            # Project configuration (database, installed apps, JWT, CORS)
│   └── urls.py                # Main URL routing → points to accounts + sales apps
├── accounts/
│   ├── models.py               # User and Outlet database tables
│   ├── serializers.py          # Converts model data <-> JSON for the API
│   ├── views.py                # Auth, registration, outlet onboarding logic
│   ├── urls.py                 # register/login/outlets routes
│   └── admin.py                # Makes User & Outlet visible in Django Admin panel
└── sales/
    ├── models.py               # Sale model (one row = one outlet's sales for one day)
    ├── serializers.py          # Validates sale amount/date
    ├── views.py                # Log sale, list sales, summary stats logic
    ├── urls.py                 # sales/create, sales/, sales/summary routes
    └── admin.py                # Makes Sale visible in Django Admin panel
```

## Example: Log a sale (replace YOUR_OWNER_TOKEN)
```bash
curl -X POST http://127.0.0.1:8000/api/sales/create/ \
  -H "Authorization: Bearer YOUR_OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount":"15000.00","note":"Good day"}'
```
Note: only outlets with `status: approved` can log sales. Submitting the same date twice automatically updates that entry instead of creating a duplicate.

## Next steps (for your next module)

Once this is tested and working, we move to **Module 4: Inventory Management** — this will add a `StockItem` model linked to `Outlet`, plus low-stock alerts based on sales velocity.
