# Kleandeck API contract

Single source of truth between the backend (`backend/`, Django) and the frontend (Lovable React app).
The backend agent owns this file and updates it with every endpoint change; the frontend agent reads it
and never calls anything not listed here.

## Changes

_None yet._

## Conventions

- Base URL: `VITE_API_URL` on the frontend (e.g. `https://api.kleandeck.com`).
- JSON in and out. Money is integer **kobo** (₦1 = 100 kobo).
- Errors: `{ "error": { "code": "string", "message": "string", "fields": { "<field>": ["message"] } } }`

## Endpoints

_None defined yet._
