# AnimoOrion conventions

Conventions for the AnimoOrion backend service.

## Rules

- Validate all input at the service boundary.
- Return typed errors; never leak raw stack traces to callers.
- Keep handlers thin; put business logic in a service layer.
- Log with structured context, never secrets.
