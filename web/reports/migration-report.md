# Migration Report

> **Generated:** {{DATE}}
> **Source:** HSQLDB (`deployment/data/database/hsqldb/default/default.script`)
> **Target:** PostgreSQL ({{DATABASE_URL}})

---

## 1. Source HSQLDB Tables Found

| # | HSQLDB Table Name | Mendix Entity | Rows Found |
|---|-------------------|---------------|-----------:|
| 1 | `administration$account` | Administration.Account | {{SRC_administration_account}} |
| 2 | `core$user` | Core.User | {{SRC_core_user}} |
| 3 | `core$activationrequest` | Core.ActivationRequest | {{SRC_core_activationrequest}} |
| 4 | `core$registrationkey` | Core.RegistrationKey | {{SRC_core_registrationkey}} |
| 5 | `domaincheck$domaincheckprovider` | DomainCheck.DomainCheckProvider | {{SRC_domaincheck_provider}} |
| 6 | `domaincheck$domaincheckcategory` | DomainCheck.DomainCheckCategory | {{SRC_domaincheck_category}} |
| 7 | `api$apicredentials` | API.APICredentials | {{SRC_api_apicredentials}} |
| 8 | `api$oauthtoken` | API.OauthToken | {{SRC_api_oauthtoken}} |
| 9 | `encryption$pgpcertificate` | Encryption.PGPCertificate | {{SRC_encryption_pgpcertificate}} |
| 10 | `forgotpassword$forgotpassword` | ForgotPassword.ForgotPassword | {{SRC_forgotpassword}} |
| 11 | `email_connector$emailtemplate` | Email_Connector.EmailTemplate | {{SRC_email_template}} |

> **Note:** `domain_checks` and `email_queue` are new tables in the PostgreSQL schema
> that do not have direct HSQLDB equivalents.

---

## 2. Target PostgreSQL Tables

| # | PostgreSQL Table | Drizzle ORM Entity | Rows After Migration |
|---|-----------------|-------------------|--------------------:|
| 1 | `users` | User | {{PG_users}} |
| 2 | `activation_requests` | ActivationRequest | {{PG_activation_requests}} |
| 3 | `registration_keys` | RegistrationKey | {{PG_registration_keys}} |
| 4 | `domain_check_providers` | DomainCheckProvider | {{PG_domain_check_providers}} |
| 5 | `domain_check_categories` | DomainCheckCategory | {{PG_domain_check_categories}} |
| 6 | `domain_checks` | DomainCheck | {{PG_domain_checks}} |
| 7 | `api_credentials` | ApiCredential | {{PG_api_credentials}} |
| 8 | `oauth_tokens` | OAuthToken | {{PG_oauth_tokens}} |
| 9 | `pgp_certificates` | PgpCertificate | {{PG_pgp_certificates}} |
| 10 | `forgot_password_requests` | ForgotPasswordRequest | {{PG_forgot_password_requests}} |
| 11 | `email_templates` | EmailTemplate | {{PG_email_templates}} |
| 12 | `email_queue` | EmailQueueItem | {{PG_email_queue}} |

---

## 3. Row Count Comparison

| Entity | HSQLDB (Source) | PostgreSQL (Target) | Delta | Status |
|--------|----------------:|--------------------:|------:|--------|
| Users | {{SRC_USERS}} | {{PG_users}} | {{DELTA_users}} | {{STATUS_users}} |
| Activation Requests | {{SRC_ACTIVATION_REQUESTS}} | {{PG_activation_requests}} | {{DELTA_activation_requests}} | {{STATUS_activation_requests}} |
| Registration Keys | {{SRC_REGISTRATION_KEYS}} | {{PG_registration_keys}} | {{DELTA_registration_keys}} | {{STATUS_registration_keys}} |
| Domain Check Providers | {{SRC_DOMAIN_CHECK_PROVIDERS}} | {{PG_domain_check_providers}} | {{DELTA_domain_check_providers}} | {{STATUS_domain_check_providers}} |
| Domain Check Categories | {{SRC_DOMAIN_CHECK_CATEGORIES}} | {{PG_domain_check_categories}} | {{DELTA_domain_check_categories}} | {{STATUS_domain_check_categories}} |
| Domain Checks | {{SRC_DOMAIN_CHECKS}} | {{PG_domain_checks}} | {{DELTA_domain_checks}} | {{STATUS_domain_checks}} |
| API Credentials | {{SRC_API_CREDENTIALS}} | {{PG_api_credentials}} | {{DELTA_api_credentials}} | {{STATUS_api_credentials}} |
| OAuth Tokens | {{SRC_OAUTH_TOKENS}} | {{PG_oauth_tokens}} | {{DELTA_oauth_tokens}} | {{STATUS_oauth_tokens}} |
| PGP Certificates | {{SRC_PGP_CERTIFICATES}} | {{PG_pgp_certificates}} | {{DELTA_pgp_certificates}} | {{STATUS_pgp_certificates}} |
| Forgot Password Req. | {{SRC_FORGOT_PASSWORD}} | {{PG_forgot_password_requests}} | {{DELTA_forgot_password_requests}} | {{STATUS_forgot_password_requests}} |
| Email Templates | {{SRC_EMAIL_TEMPLATES}} | {{PG_email_templates}} | {{DELTA_email_templates}} | {{STATUS_email_templates}} |
| Email Queue | {{SRC_EMAIL_QUEUE}} | {{PG_email_queue}} | {{DELTA_email_queue}} | {{STATUS_email_queue}} |

**Legend:** ✅ Match | ❌ Mismatch | ⚠️ Needs Review

---

## 4. Foreign Key Integrity

| Constraint | Check | Status |
|------------|-------|--------|
| `domain_checks.user_id → users.id` | No orphaned records | {{FK_domain_checks_users}} |
| `domain_checks.provider_id → domain_check_providers.id` | No orphaned records | {{FK_domain_checks_providers}} |
| `domain_checks.category_id → domain_check_categories.id` | No orphaned records | {{FK_domain_checks_categories}} |

> **What is verified:** The LEFT JOIN anti-pattern finds rows in the child table
> that reference a non-existent parent row. Zero orphans = PASS.

---

## 5. Encrypted Fields Verification

| Field | Rows with NULL/Empty | Status |
|-------|---------------------:|--------|
| `users.password_hash` | {{ENC_password_hash}} | {{STATUS_ENC_password_hash}} |
| `domain_check_providers.api_key_encrypted` | {{ENC_api_key_encrypted}} | {{STATUS_ENC_api_key_encrypted}} |
| `api_credentials.password_encrypted` | {{ENC_password_encrypted}} | {{STATUS_ENC_password_encrypted}} |
| `pgp_certificates.passphrase_encrypted` | {{ENC_passphrase_encrypted}} | {{STATUS_ENC_passphrase_encrypted}} |

> **Note:** Some NULL values may be legitimate (e.g., users who haven't set a
> password yet). Investigate any unexpected NULLs.

---

## 6. Overall Verdict

| Category | Passed | Total |
|----------|-------:|------:|
| Row count checks | {{ROW_PASSED}} | {{ROW_TOTAL}} |
| FK integrity checks | {{FK_PASSED}} | {{FK_TOTAL}} |
| Encrypted field checks | {{ENC_PASSED}} | {{ENC_TOTAL}} |

**Final Verdict:** {{VERDICT}}

---

## 7. Notes

- **Migration Script:** `web/scripts/migrate.mjs`
- **Verification Script:** `web/scripts/verify.mjs`
- **Schema Definition:** `web/src/db/schema.ts`
- **Source Data:** `deployment/data/database/hsqldb/default/default.script`
- **Table Name Mapping:** The migration creates tables using HSQLDB naming conventions
  (e.g., `administration$account`). The application schema uses PostgreSQL conventions
  (e.g., `users`). A separate ETL step may be needed to transform between naming
  conventions.
- **Empty Tables:** Most business entity tables in the HSQLDB dump are empty
  (only `administration$account` and `core$user` contain seed data).
