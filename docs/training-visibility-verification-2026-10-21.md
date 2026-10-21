# Training completion access verification — October 21, 2026

The new training_visibility.sql regression suite executes the production portal_operations RPC under the authenticated and anon database roles, with temporary fixtures in a rolled-back transaction.

Two members complete different resources. Each member sees a completion timestamp only for their own resource and receives an empty progress roster. A forged owner field cannot complete training for another member, and forged client admin/role fields and signup user_metadata do not elevate access.

An E-board account with no admin metadata and an admin account with no E-board flag each see both member completion records. Revoking E-board access immediately removes roster visibility. Disabling the admin account immediately denies the RPC. Direct SELECT from the progress table and anonymous RPC access are denied.

All checks passed. No authorization or application changes were needed. Existing Training UI renders the member-completion roster only when its server-derived officer flag is true; the backend independently enforces this boundary. This verification did not sign into real members' accounts or claim a new browser login test. All test users, training entries, completion records and audit fixtures rolled back. Real member data was unchanged.
