# Inventory App

Full Express + EJS inventory management app for a graduate database project.
Part 3 expands the project to all seven tables in the PostgreSQL schema,
adds views, functions, procedures, triggers, and includes aggregated reports.

## What this project does

- Connects an Express + EJS app to PostgreSQL
- Provides CRUD interfaces for:
  - `users`
  - `locations`
  - `software`
  - `computers`
  - `assignments`
  - `deaccessions`
  - `computers_software` as software installations
- Uses PostgreSQL procedures and triggers for:
  - assignment creation
  - assignment return
  - deaccession workflows
- Includes report pages backed by PostgreSQL views

## Prerequisites

- Node.js and npm installed
- PostgreSQL installed and running
- A PostgreSQL user that can create a database and load SQL files

## 1. Install dependencies

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

## 3. Configure environment variables

Copy `.env.example` to `.env` and add your database connection string:

```env
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/inventory_app
```

## 4. Load the database objects and seed data

Run the full setup script:

```bash
set -a
source .env
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/setup.sql
```

If you prefer explicit files, the setup order is:

1. `db/schema.sql`
2. `db/programming.sql`
3. `db/seed.sql`

The setup script creates:

- 7 tables
- multiple views
- multiple functions
- stored procedures
- triggers
- demo seed data

## 5. Start the app

```bash
npm start
```

For development:

```bash
npm run dev
```

## 6. Open the app

Visit:

[http://localhost:3000](http://localhost:3000)

The root URL redirects to `/computers`.

## Main Routes

- `/users`
- `/locations`
- `/software`
- `/computers`
- `/assignments`
- `/deaccessions`
- `/software-installations`
- `/reports`

## Suggested Demo Flow

1. Open `/computers` to show the full inventory table
2. Show that computer `Location` is chosen from the `locations` table
3. Create an assignment from `/assignments`
4. Return that assignment and show the computer status update
5. Create a deaccession record and show the computer status update
6. Open `/software-installations` to show the join table
7. Open `/reports` to show aggregated view-based reports

## Project Structure

- [server.js](server.js): app entrypoint
- [app/](app/): Express app, shared helpers, and route modules
- [db/schema.sql](db/schema.sql): table DDL and constraints
- [db/programming.sql](db/programming.sql): views, functions, procedures, triggers
- [db/seed.sql](db/seed.sql): demo seed data
- [db/setup.sql](db/setup.sql): runs schema, programming objects, and seed in order
- [views/](views/): EJS templates
- [public/styles.css](public/styles.css): app styling

## Notes

- Foreign keys are represented in the UI with readable dropdowns, not raw IDs.
- `assignments` and `deaccessions` use workflow procedures to keep computer
  lifecycle changes synchronized.
- Seed data is included so the reports page and all CRUD areas can be demoed
  immediately after setup.
