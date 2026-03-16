# Inventory App

Simple CRUD web app. Part 2 focuses on a
single-table UI for the `mydb.computers` table in PostgreSQL.

## What this project does

- Connects an Express + EJS app to PostgreSQL
- Displays a dashboard with a quick summary of computer records
- Supports create, read, update, and delete operations for computers
- Uses the schema in [db/schema.sql](db/schema.sql)

## Deploy on Railway (self-host in your own account)

[![Open in Railway](https://railway.com/button.svg)](https://railway.com/new)

> Railway currently sends this button to the **New Project** screen (`/new`).
> That is expected. From there, choose **GitHub Repository** and select this repo.

This repo includes a `railway.json` config that runs:

- `npm run migrate` to apply `db/schema.sql`
- `npm start` to launch Express

### Deploy steps

1. Click the Railway button above.
2. Choose **GitHub Repository** and select `inventory-app`.
3. In the same Railway project, click **+ New** and add a **PostgreSQL** service.
4. Open your web service → **Variables** and set:
   - `DATABASE_URL` = Postgres connection string (from your Railway Postgres service)
5. Redeploy the web service.

### Why the button does not open this repo directly

The generic Railway button opens project creation. Repository preselection depends on Railway-side template publishing or GitHub integration state, so landing on `/new` is normal.

### If Railway does not show your GitHub repo

Railway can only list repositories that the Railway GitHub app can access.

1. In Railway: **Account Settings → Integrations → GitHub** and reconnect if needed.
2. In GitHub: **Settings → Applications → Installed GitHub Apps → Railway**.
3. Under repository access, choose **All repositories** or explicitly include `inventory-app`.
4. Return to Railway and refresh the repo list.

## Prerequisites

- Node.js and npm installed
- PostgreSQL installed and running
- A PostgreSQL user that can create a database and load the schema

## 1. Clone the project and install dependencies

```bash
npm install
```

## 2. Create the database

Create a database named `inventory_app`:

```bash
createdb -h 127.0.0.1 -U postgres inventory_app
```

If `createdb` is not in your `PATH`, use the full PostgreSQL install path on
your machine.

## 3. Load the schema

Run the schema file:

```bash
psql -h 127.0.0.1 -U postgres -d inventory_app -f db/schema.sql
```

This creates the `mydb` schema and all tables used by the app.

## 4. Configure environment variables

Copy `.env.example` to `.env` and add your database connection string:

```env
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/inventory_app
```

## 5. Start the app

For normal use:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

## 6. Open the app

Visit:

[http://localhost:3000](http://localhost:3000)

## Part 2 Demo Flow

Use the app like this:

1. Open `/computers`
2. Click `Add computer`
3. Create a new row in the `computers` table
4. Return to the list and confirm the row appears
5. Click `Edit` to update values like status or model
6. Click `Delete` to remove the row

For part 2, `current_location_id` is intentionally left blank, to just focus work on the `computers` table.

## Project Structure

- [server.js](server.js): Express server and CRUD routes
- [db/schema.sql](db/schema.sql): PostgreSQL schema
- [views/](views/): EJS templates - User interface for CRUD operations.
- [public/styles.css](public/styles.css): App styling

## Notes

- The app currently focuses on the `computers` table for the single-table CRUD
  requirement.
- `db/seed.sql` is currently empty, so new databases will start without sample
  data.
- If the database is empty, create the first computer record through the UI.
