---
domain: auth
tags:
  - jwt
  - redis
---

# Auth Debugging Notes

## Summary

Token refresh depends on `refreshSession` in src/session.ts.

## Related Files

- src/auth.ts
- src/session.ts

## Debugging Conclusions

- loginUser calls refreshSession during auth flow.
