# Beacon2 — Known Issues and Deferred Items

Items noted during development that need addressing in future sessions.

---

## Gift Aid

1. **Joint/family membership Gift Aid handling** — When a member's class has the
   joint attribute (`is_joint`) and the payer has `gift_aid_from` set, the full
   joint fee should qualify for Gift Aid even if the partner doesn't pay tax.
   Currently the Gift Aid declaration does not apply any special joint-membership
   logic. The HMRC declaration row should show against the paying member only
   (not the partner separately). Ref: Beacon User Guide 7.8.
