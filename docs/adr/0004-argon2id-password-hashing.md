# ADR-0004: Argon2id with stated parameters

- Status: Accepted
- Date: 2026-10-16
- Requirements: FR-01.4, FR-02.4, NFR-S1

## Context
Passwords must never be stored in plaintext, and a stolen database should make passwords as hard as possible to recover. The brief requires Argon2id.

## Decision
Hash passwords with Argon2id through the `argon2` package, using memory 19456 KiB, time cost 2 and parallelism 1, with a random salt per password. These match one of the configurations listed in OWASP's Password Storage Cheat Sheet, and should be checked against its current text when implementing S4-1.

The parameters are stored inside each hash string. On a successful login, a hash made with weaker parameters is replaced by one made with the current parameters. For unknown emails the API verifies the supplied password against a dummy hash made at startup with the same parameters, so the work done does not reveal whether an account exists.

## Alternatives considered
- **bcrypt.** Widely used and acceptable, but it needs little memory, so it resists GPU attacks less well than Argon2id, and it truncates long inputs.
- **scrypt.** Memory-hard and built into Node, but less commonly recommended now than Argon2id.
- **Higher memory settings.** Stronger per hash, but each login ties up more memory. On a small Docker host, with no rate limiting (risk R1), a moderate setting is the safer balance.

## Consequences
- Each login or registration uses about 19 MiB of memory briefly. Many parallel logins could pressure a small host, which is one more reason rate limiting is future work.
- The `argon2` package includes native code, so the Docker image and CI must build or download a matching binary. This is checked in Stage 2.
- Parameters can be raised later without a migration, because hashes carry their own parameters.
