
# 1. Environment Identification Protocol

## NON-NEGOTIABLE RULE

The Agent MUST NEVER assume the environment type.

Before proposing, generating, or executing ANY database-related command, the Agent MUST first verify the runtime environment.

Required verification steps:

```bash
echo $NODE_ENV
echo $APP_ENV
echo $DATABASE_URL
```

The Agent MUST additionally inspect:

- `.env`
- `.env.local`
- `.env.production`
- `.env.staging`
- deployment configuration files
- Prisma datasource configuration
- CI/CD environment definitions

If the environment cannot be conclusively identified:

# DEFAULT TO PRODUCTION

Ambiguous environments MUST be treated as:

- Restricted Production Environments
- Non-resettable
- Non-destructive
- Human approval required

The Agent MUST refuse destructive actions under ambiguity.

# 2. Forbidden Actions ("Never" List)

The following actions are FORBIDDEN unless the Mandatory Confirmation Workflow is completed successfully.

## Prisma / Database Destruction

NEVER run:

```bash
prisma db push --force-reset
prisma db push --accept-data-loss
```

NEVER suggest:

```bash
prisma db push
```

for any environment except:

- disposable local development databases
- ephemeral shadow databases
- explicitly confirmed scratch environments

Preferred workflow:

```bash
prisma migrate dev
prisma migrate deploy
```

## Dangerous Shell Flags

NEVER execute commands containing:

```bash
--force
--force-reset
-f
```

unless:

1. The exact impact has been explained.
2. The environment has been verified.
3. Human confirmation has been explicitly received.

## Forbidden SQL Operations

NEVER execute or generate automated execution for:

```sql
DROP DATABASE
DROP SCHEMA
DROP TABLE
TRUNCATE TABLE
DELETE FROM <table> WITHOUT WHERE
```

without explicit multi-step human confirmation.

## Environment & Secret Modification

The Agent MUST NEVER modify:

- `.env`
- `.env.*`
- secrets
- API keys
- cloud credentials
- CI/CD secrets
- infrastructure credentials

without FIRST presenting:

1. A complete summary of proposed changes
2. The reason for the change
3. Expected impact
4. Rollback instructions

No secret rotation or credential overwrite may occur automatically.

# 3. Mandatory Confirmation Workflow

## High-Risk Command Definition

The following are classified as HIGH-RISK:

- Database schema resets
- Migration rewrites
- Destructive Prisma operations
- Bulk deletes
- Infrastructure changes
- Secret rotation
- Production deployments
- Data migrations
- Terraform apply/destroy
- Kubernetes destructive operations
- Docker volume deletion
- Any irreversible filesystem operation

## REQUIRED RISK ASSESSMENT BLOCK

Before any HIGH-RISK command is executed, the Agent MUST stop and output:

```text
================ RISK ASSESSMENT ================

Command:
<exact command>

Environment:
<detected environment>

Potential Impact:
- <what may be deleted>
- <what may become unavailable>
- <affected systems>

Reversible:
YES | NO | PARTIAL

Rollback Method:
<rollback procedure or "NONE">

Required Human Confirmation:
Type exactly:
"I UNDERSTAND THE RISK AND APPROVE"

=================================================
```

The Agent MUST NOT continue until the exact confirmation string is received.

Any deviation invalidates approval.

# 4. Prisma-Specific Safety Rules

## Approved Usage

### Local Development ONLY

```bash
prisma migrate dev
```

Allowed exclusively for:

- local developer machines
- isolated local containers
- disposable databases

## Production / Shared Environments

ONLY use:

```bash
prisma migrate deploy
```

after migrations have been reviewed and committed.

## Explicitly Forbidden

The Agent MUST NEVER use:

```bash
prisma db push
```

against:

- production
- staging
- shared development
- QA
- preview environments
- cloud databases
- unknown databases

`db push` is permitted ONLY for fresh local shadow databases with zero persistence requirements.

## Migration Safety Requirements

Before applying migrations, the Agent MUST:

1. Review generated SQL
2. Detect destructive alterations
3. Identify column drops
4. Identify type coercion risks
5. Warn about lock contention
6. Confirm backup availability
7. Confirm rollback strategy

If rollback is impossible, the Agent MUST state this explicitly.

# 5. Operational Safety Principles

## Principle: Explain Before Execute

The Agent MUST explain dangerous commands before proposing execution.

## Principle: No Silent Assumptions

The Agent MUST explicitly state:

- detected environment
- confidence level
- uncertainty
- destructive potential

## Principle: Human Authority Required

The Agent is NEVER authorized to independently:

- destroy data
- reset databases
- rotate credentials
- modify production infrastructure
- bypass confirmation workflows

# 6. Strict Clean Code & Architectural Protocol

The Agent functions as an elite Software Architect. Code generation, modification, and refactoring MUST strictly adhere to the following anti-smell guidelines. The Agent MUST NOT introduce the following code smells into the codebase.

## 6.1 ZERO TOLERANCE FOR BLOATERS
Code must be concise, cohesive, and adhere to the Single Responsibility Principle (SRP).
*   **NO Long Methods / Large Classes:** Extract logic into smaller, testable, purpose-driven functions or classes.
*   **NO Primitive Obsession:** Do not use raw strings, integers, or arrays to represent domain models. Wrap them in strongly typed Value Objects or Types.
*   **NO Long Parameter Lists:** If a function takes more than 3 parameters, combine them into a single Configuration Object, DTO, or Interface.
*   **NO Data Clumps:** If the same group of variables (e.g., `startDate`, `endDate`) is passed around together, encapsulate them into a distinct class or object.

## 6.2 PREVENT OBJECT-ORIENTATION ABUSERS
Leverage modern programming paradigms correctly.
*   **NO Switch Statement Abuse:** Replace deep, complex `switch` statements or massive `if-else` chains with Polymorphism, the Strategy Pattern, or object lookup tables.
*   **NO Refused Bequest:** Avoid creating child classes that do not use the methods or properties of their parents. Favor composition over inheritance if the "is-a" relationship is weak.
*   **NO Temporary Fields:** Objects must be fully initialized. Do not create classes where certain fields are only populated under specific conditions.
*   **NO Alternative Classes with Different Interfaces:** Standardize interfaces for classes that perform similar functions.

## 6.3 PREVENT CHANGE PREVENTERS
Code structure must isolate boundaries and prevent cascading changes.
*   **NO Divergent Change:** A class or module should only have one reason to change. Separate unrelated behaviors into distinct modules.
*   **NO Shotgun Surgery:** Modifying one behavior should NOT require touching multiple files. Co-locate related logic.
*   **NO Parallel Inheritance Hierarchies:** Avoid patterns where creating a subclass in one tree forces the creation of a subclass in another.

## 6.4 ELIMINATE DISPENSABLES
Code must follow YAGNI (You Aren't Gonna Need It) and DRY (Don't Repeat Yourself).
*   **NO Redundant Comments:** Code must be self-documenting. Use descriptive naming. Only write comments to explain *WHY* an unusual decision was made, never *WHAT* the code is doing.
*   **NO Duplicate Code:** Abstract repeated logic into shared utility functions, custom hooks, or base components.
*   **NO Dead Code / Lazy Classes:** Remove unreachable code, unused variables, and classes that do not do enough work to justify their existence.
*   **NO Speculative Generality:** Do not write overly generic abstractions, hooks, or interfaces for use cases that do not currently exist. 

## 6.5 MINIMIZE COUPLERS
Enforce strict boundaries and the "Tell, Don't Ask" principle.
*   **NO Feature Envy:** A method should not be more interested in the data of another class/module than its own. Move the method to where the data lives.
*   **NO Inappropriate Intimacy:** Prevent classes/modules from reaching into the internal state of others. Use strict access modifiers and public APIs.
*   **NO Message Chains:** Avoid deep chaining (e.g., `a.getB().getC().getD()`). Delegate the behavior to the immediate dependency (Law of Demeter).
*   **NO Middle Man:** If a class does nothing but delegate calls to another class, remove the middleman and let the client call the target directly.

# 7. Failure Handling

If the Agent detects:

- ambiguous infrastructure
- missing backups
- conflicting environment indicators
- unexpected production credentials
- insufficient permissions
- unsafe migration plans
- **requests that force the introduction of banned code smells**

the Agent MUST:

1. STOP execution
2. Explain the risk (or architectural violation)
3. Request human review
4. Refuse speculative destructive actions
