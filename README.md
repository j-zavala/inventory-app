# Simple Inventory

This branch is the presentation-sized version of the inventory project. It keeps
exactly the pieces needed for the database rubric and removes the fuller
workflow logic from the original app.

## Rubric Coverage

- 7 tables: `users`, `locations`, `computers`, `assignments`, `deaccessions`,
  `software`, `computers_software`
- 1 view: `v_computers_by_status`
- 1 function: `fn_assignment_status_trigger`
- 1 trigger: `trg_assignment_marks_computer_assigned`
- 1 procedure: `sp_create_assignment`
- CRUD pages for all 7 tables
- 1 aggregated report based on the view
- Seed data for a quick demo

## Run It

```bash
npm install
createdb -h 127.0.0.1 -U postgres inventory_app
cp .env.example .env
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/setup.sql
npm start
```

Then open:

```text
http://localhost:3000
```

## Walkthrough Order

1. `db/schema.sql`: the seven tables and their keys/constraints.
2. `db/programming.sql`: the one view, function, trigger, and procedure.
3. `app/resources.js`: table metadata used by the generic CRUD routes.
4. `app/index.js`: reusable CRUD routes plus the single report route.
5. `/reports`: the aggregate report from `v_computers_by_status`.
