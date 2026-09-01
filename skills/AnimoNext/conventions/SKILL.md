# AnimoNext conventions

Conventions for the AnimoNext Next.js app.

## Rules

- Default to Server Components; add `"use client"` only when needed.
- Keep data fetching in server code; never expose secrets to the client.
- Co-locate route segments with their loading and error states.
- Type route params and search params explicitly.
