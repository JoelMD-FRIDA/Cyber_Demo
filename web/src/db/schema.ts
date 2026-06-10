import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  customType,
  pgEnum,
} from 'drizzle-orm/pg-core';

// bytea column type for PostgreSQL binary storage
const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return 'bytea';
  },
});
import { relations } from 'drizzle-orm';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// ── Enums ────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', ['admin', 'user']);
export const certificateTypeEnum = pgEnum('certificate_type', ['public', 'private']);
export const emailStatusEnum = pgEnum('email_status', ['pending', 'sent', 'failed']);

// ── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }).unique(),
  firstname: varchar('firstname', { length: 255 }),
  lastname: varchar('lastname', { length: 255 }),
  company: varchar('company', { length: 255 }),
  performedDomainChecks: integer('performed_domain_checks').default(0).notNull(),
  isActivated: boolean('is_activated').default(false).notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  passwordHash: varchar('password_hash', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// ── Activation Requests ──────────────────────────────────────────────────────

export const activationRequests = pgTable('activation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  uuid: uuid('uuid').notNull().unique(),
  fullname: varchar('fullname', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  confirmationLink: varchar('confirmation_link', { length: 2048 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ActivationRequest = InferSelectModel<typeof activationRequests>;
export type NewActivationRequest = InferInsertModel<typeof activationRequests>;

// ── Registration Keys ────────────────────────────────────────────────────────

export const registrationKeys = pgTable('registration_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 255 }).notNull().unique(),
  companyDomain: varchar('company_domain', { length: 255 }),
  totalSlots: integer('total_slots').notNull(),
  company: varchar('company', { length: 255 }),
  usedCount: integer('used_count').default(0).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type RegistrationKey = InferSelectModel<typeof registrationKeys>;
export type NewRegistrationKey = InferInsertModel<typeof registrationKeys>;

// ── Domain Check Providers ─────────────────────────────────────────────────--

export const domainCheckProviders = pgTable('domain_check_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  uuid: uuid('uuid').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  websiteUrl: varchar('website_url', { length: 2048 }),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 700 }),
  longDescription: varchar('long_description', { length: 2000 }),
  apiBaseUrl: varchar('api_base_url', { length: 200 }),
  apiKeyEncrypted: text('api_key_encrypted'),
  logoFileDocumentId: uuid('logo_file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DomainCheckProvider = InferSelectModel<typeof domainCheckProviders>;
export type NewDomainCheckProvider = InferInsertModel<typeof domainCheckProviders>;

// ── Domain Check Categories ──────────────────────────────────────────────────

export const domainCheckCategories = pgTable('domain_check_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  uuid: uuid('uuid').notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  iconFileDocumentId: uuid('icon_file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DomainCheckCategory = InferSelectModel<typeof domainCheckCategories>;
export type NewDomainCheckCategory = InferInsertModel<typeof domainCheckCategories>;

// ── Domain Checks ────────────────────────────────────────────────────────────

export const domainChecks = pgTable('domain_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  providerId: uuid('provider_id')
    .notNull()
    .references(() => domainCheckProviders.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => domainCheckCategories.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 2048 }).notNull(),
  status: varchar('status', { length: 50 }),
  results: jsonb('results'),
  hasAcceptedDisclaimer: boolean('has_accepted_disclaimer').default(false),
  disclaimerAcceptedAt: timestamp('disclaimer_accepted_at'),
  disclaimerVersion: varchar('disclaimer_version', { length: 20 }),
  providerCount: integer('provider_count').default(0),
  remainingDomainChecks: integer('remaining_domain_checks').default(0),
  maxChecks: integer('max_checks').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DomainCheck = InferSelectModel<typeof domainChecks>;
export type NewDomainCheck = InferInsertModel<typeof domainChecks>;

export const domainChecksRelations = relations(domainChecks, ({ one }) => ({
  user: one(users, {
    fields: [domainChecks.userId],
    references: [users.id],
  }),
  provider: one(domainCheckProviders, {
    fields: [domainChecks.providerId],
    references: [domainCheckProviders.id],
  }),
  category: one(domainCheckCategories, {
    fields: [domainChecks.categoryId],
    references: [domainCheckCategories.id],
  }),
}));

// ── API Credentials ──────────────────────────────────────────────────────────

export const apiCredentials = pgTable('api_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiUrl: varchar('api_url', { length: 2048 }).notNull(),
  oauthUrl: varchar('oauth_url', { length: 2048 }),
  username: varchar('username', { length: 255 }),
  passwordEncrypted: text('password_encrypted'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ApiCredential = InferSelectModel<typeof apiCredentials>;
export type NewApiCredential = InferInsertModel<typeof apiCredentials>;

// ── OAuth Tokens ─────────────────────────────────────────────────────────────

export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  accessToken: text('access_token').notNull(),
  expiresIn: integer('expires_in'),
  refreshExpiresIn: integer('refresh_expires_in'),
  tokenType: varchar('token_type', { length: 50 }),
  scope: varchar('scope', { length: 2048 }),
  expiryDate: timestamp('expiry_date'),
  providerId: varchar('provider_id', { length: 255 }),
});

export type OAuthToken = InferSelectModel<typeof oauthTokens>;
export type NewOAuthToken = InferInsertModel<typeof oauthTokens>;

// ── PGP Certificates ─────────────────────────────────────────────────────────

export const pgpCertificates = pgTable('pgp_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  certificateType: certificateTypeEnum('certificate_type').notNull(),
  passphraseEncrypted: text('passphrase_encrypted'),
  fileDocumentId: uuid('file_document_id').references(() => fileDocuments.id, { onDelete: 'set null' }),
  reference: varchar('reference', { length: 255 }),
  emailAddress: varchar('email_address', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type PgpCertificate = InferSelectModel<typeof pgpCertificates>;
export type NewPgpCertificate = InferInsertModel<typeof pgpCertificates>;

export const pgpCertificatesRelations = relations(pgpCertificates, ({ one }) => ({
  fileDocument: one(fileDocuments, {
    fields: [pgpCertificates.fileDocumentId],
    references: [fileDocuments.id],
  }),
}));

// ── Forgot Password Requests ─────────────────────────────────────────────────

export const forgotPasswordRequests = pgTable('forgot_password_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAddress: varchar('email_address', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }),
  userFullName: varchar('user_full_name', { length: 255 }),
  guid: varchar('guid', { length: 255 }).notNull().unique(),
  url: varchar('url', { length: 2048 }),
  validUntil: timestamp('valid_until'),
  isSignup: boolean('is_signup').default(false).notNull(),
});

export type ForgotPasswordRequest = InferSelectModel<typeof forgotPasswordRequests>;
export type NewForgotPasswordRequest = InferInsertModel<typeof forgotPasswordRequests>;

// ── Email Templates ──────────────────────────────────────────────────────────

export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  fromAddress: varchar('from_address', { length: 2000 }),
  fromDisplayName: varchar('from_display_name', { length: 2000 }),
  replyTo: varchar('reply_to', { length: 2000 }),
  bcc: text('bcc'),
  cc: text('cc'),
  plainBody: text('plain_body'),
  to: text('to'),
  hasAttachment: boolean('has_attachment').default(false),
  signed: boolean('signed').default(false),
  encrypted: boolean('encrypted').default(false),
  useOnlyPlainText: boolean('use_only_plain_text').default(false),
  templateName: varchar('template_name', { length: 2000 }),
  sentDate: timestamp('sent_date'),
  recipientsToggle: boolean('recipients_toggle').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailTemplate = InferSelectModel<typeof emailTemplates>;
export type NewEmailTemplate = InferInsertModel<typeof emailTemplates>;

// ── Email Queue ──────────────────────────────────────────────────────────────

export const emailQueue = pgTable('email_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  to: varchar('to', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  status: emailStatusEnum('status').default('pending').notNull(),
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  retryCount: integer('retry_count').default(0).notNull(),
  errorMessage: text('error_message'),
});

export type EmailQueueItem = InferSelectModel<typeof emailQueue>;
export type NewEmailQueueItem = InferInsertModel<typeof emailQueue>;

// ═══════════════════════════════════════════════════════════════════════════════
// NEW TABLES — Task 2: Mendix Entity Parity Expansion
// ═══════════════════════════════════════════════════════════════════════════════

// ── Domain Check Results (structured typed columns replacing jsonb) ─────────

export const domainCheckResults = pgTable('domain_check_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  domainCheckId: uuid('domain_check_id')
    .notNull()
    .references(() => domainChecks.id, { onDelete: 'cascade' })
    .unique(),
  categoryId: uuid('category_id')
    .notNull()
    .references(() => domainCheckCategories.id, { onDelete: 'cascade' }),
  resultsPWLeaks: integer('results_pw_leaks').default(0),
  resultsEmailLeaks: integer('results_email_leaks').default(0),
  resultsEoLSoftware: integer('results_eol_software').default(0),
  resultsOpenPorts: integer('results_open_ports').default(0),
  resultsSPFRecord: boolean('results_spf_record').default(false),
  hasSPFRecordResult: boolean('has_spf_record_result').default(false),
  hasDarknetResults: boolean('has_darknet_results').default(false),
  hasSoftwareResults: boolean('has_software_results').default(false),
  hasOpenPortsResults: boolean('has_open_ports_results').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type DomainCheckResult = InferSelectModel<typeof domainCheckResults>;
export type NewDomainCheckResult = InferInsertModel<typeof domainCheckResults>;

export const domainCheckResultsRelations = relations(domainCheckResults, ({ one }) => ({
  domainCheck: one(domainChecks, {
    fields: [domainCheckResults.domainCheckId],
    references: [domainChecks.id],
  }),
  category: one(domainCheckCategories, {
    fields: [domainCheckResults.categoryId],
    references: [domainCheckCategories.id],
  }),
}));

// ── File Documents (bytea storage placeholder — Task 3) ──────────────────────

export const fileDocuments = pgTable('file_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 400 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }),
  size: integer('size').default(-1),
  hasContents: boolean('has_contents').default(false),
  content: bytea('content'),
  reference: varchar('reference', { length: 255 }),
  referenceId: uuid('reference_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type FileDocument = InferSelectModel<typeof fileDocuments>;
export type NewFileDocument = InferInsertModel<typeof fileDocuments>;

// ── App Settings (singleton key-value — DomainCheck.AppSettings) ────────────

export const appSettings = pgTable('app_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  maximumNumberOfChecks: integer('maximum_number_of_checks').default(10).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type AppSetting = InferSelectModel<typeof appSettings>;
export type NewAppSetting = InferInsertModel<typeof appSettings>;

// ── System Languages (System.Language) ───────────────────────────────────────

export const systemLanguages = pgTable('system_languages', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: varchar('description', { length: 200 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type SystemLanguage = InferSelectModel<typeof systemLanguages>;
export type NewSystemLanguage = InferInsertModel<typeof systemLanguages>;

// ── LDAP Configurations (Email_Connector.LDAPConfiguration) ─────────────────

export const ldapConfigurations = pgTable('ldap_configurations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ldapHost: varchar('ldap_host', { length: 2000 }).notNull(),
  ldapPort: integer('ldap_port').default(389),
  ldapUsername: varchar('ldap_username', { length: 2000 }).notNull(),
  ldapPasswordEncrypted: text('ldap_password_encrypted').notNull(),
  baseDN: varchar('base_dn', { length: 2000 }).notNull(),
  authType: integer('auth_type'),
  isSSL: boolean('is_ssl').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type LdapConfiguration = InferSelectModel<typeof ldapConfigurations>;
export type NewLdapConfiguration = InferInsertModel<typeof ldapConfigurations>;

// ── OAuth Providers (Email_Connector.OAuthProvider) ─────────────────────────

export const oauthProviders = pgTable('oauth_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 2000 }).notNull(),
  oAuthType: integer('oauth_type').notNull(),
  authorizationEndpoint: varchar('authorization_endpoint', { length: 2000 }).notNull(),
  tokenEndpoint: varchar('token_endpoint', { length: 2000 }).notNull(),
  clientId: varchar('client_id', { length: 2000 }).notNull(),
  clientSecretEncrypted: text('client_secret_encrypted').notNull(),
  tenantId: varchar('tenant_id', { length: 2000 }),
  emailDomain: varchar('email_domain', { length: 2000 }).notNull(),
  callbackUrl: varchar('callback_url', { length: 2000 }).notNull(),
  callbackOperationPath: varchar('callback_operation_path', { length: 2000 }).notNull(),
  openIdWellKnownMetadataUri: varchar('open_id_well_known_metadata_uri', { length: 2000 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type OAuthProvider = InferSelectModel<typeof oauthProviders>;
export type NewOAuthProvider = InferInsertModel<typeof oauthProviders>;

// ── Email Accounts (Email_Connector.EmailAccount) ────────────────────────────

export const emailAccounts = pgTable('email_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  mailAddress: varchar('mail_address', { length: 2000 }).notNull(),
  username: varchar('username', { length: 2000 }).notNull(),
  passwordEncrypted: text('password_encrypted').notNull(),
  fromDisplayName: varchar('from_display_name', { length: 2000 }).notNull(),
  timeout: integer('timeout').default(20000),
  isSharedMailbox: boolean('is_shared_mailbox').default(false),
  isP12Configured: boolean('is_p12_configured').default(false),
  isOAuthUsed: boolean('is_oauth_used').default(false),
  isLDAPConfigured: boolean('is_ldap_configured').default(false),
  isOutgoingEmailConfigured: boolean('is_outgoing_email_configured').default(false),
  isIncomingEmailConfigured: boolean('is_incoming_email_configured').default(false),
  sanitizeEmailBodyForXSS: boolean('sanitize_email_body_for_xss').default(false),
  isEmailConfigAutoDetect: boolean('is_email_config_auto_detect').default(true),
  useSSLCheckServerIdentity: boolean('use_ssl_check_server_identity').default(false),
  ldapConfigurationId: uuid('ldap_configuration_id').references(() => ldapConfigurations.id, { onDelete: 'set null' }),
  oauthProviderId: uuid('oauth_provider_id').references(() => oauthProviders.id, { onDelete: 'set null' }),
  oauthTokenId: uuid('oauth_token_id').references(() => oauthTokens.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type EmailAccount = InferSelectModel<typeof emailAccounts>;
export type NewEmailAccount = InferInsertModel<typeof emailAccounts>;

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  ldapConfiguration: one(ldapConfigurations, {
    fields: [emailAccounts.ldapConfigurationId],
    references: [ldapConfigurations.id],
  }),
  oauthProvider: one(oauthProviders, {
    fields: [emailAccounts.oauthProviderId],
    references: [oauthProviders.id],
  }),
  oauthToken: one(oauthTokens, {
    fields: [emailAccounts.oauthTokenId],
    references: [oauthTokens.id],
  }),
  outgoingConfigs: many(outgoingEmailConfigs),
  incomingConfigs: many(incomingEmailConfigs),
  emailMessages: many(emailMessages),
}));

// ── Outgoing Email Configs (Email_Connector.OutgoingEmailConfiguration) ──────

export const outgoingEmailConfigs = pgTable('outgoing_email_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  serverHost: varchar('server_host', { length: 2000 }).notNull(),
  serverPort: integer('server_port').default(0),
  outgoingProtocol: integer('outgoing_protocol').notNull(),
  ssl: boolean('ssl').default(false),
  tls: boolean('tls').default(false),
  sendMaxAttempts: integer('send_max_attempts').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type OutgoingEmailConfig = InferSelectModel<typeof outgoingEmailConfigs>;
export type NewOutgoingEmailConfig = InferInsertModel<typeof outgoingEmailConfigs>;

export const outgoingEmailConfigsRelations = relations(outgoingEmailConfigs, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [outgoingEmailConfigs.emailAccountId],
    references: [emailAccounts.id],
  }),
}));

// ── Incoming Email Configs (Email_Connector.IncomingEmailConfiguration) ──────

export const incomingEmailConfigs = pgTable('incoming_email_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  serverHost: varchar('server_host', { length: 2000 }).notNull(),
  serverPort: integer('server_port').default(0),
  incomingProtocol: integer('incoming_protocol').notNull(),
  folder: varchar('folder', { length: 2000 }).default('INBOX'),
  batchSize: integer('batch_size').default(50),
  fetchStrategy: integer('fetch_strategy'),
  handling: integer('handling'),
  moveFolder: varchar('move_folder', { length: 2000 }),
  processInlineImage: boolean('process_inline_image').default(false),
  notifyOnNewEmails: boolean('notify_on_new_emails').default(false),
  useBatchImport: boolean('use_batch_import').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type IncomingEmailConfig = InferSelectModel<typeof incomingEmailConfigs>;
export type NewIncomingEmailConfig = InferInsertModel<typeof incomingEmailConfigs>;

export const incomingEmailConfigsRelations = relations(incomingEmailConfigs, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [incomingEmailConfigs.emailAccountId],
    references: [emailAccounts.id],
  }),
}));

// ── Email Messages (Email_Connector.EmailMessage) ────────────────────────────

export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  emailTemplateId: uuid('email_template_id')
    .references(() => emailTemplates.id, { onDelete: 'set null' }),
  from: varchar('from', { length: 2000 }).notNull(),
  to: text('to').notNull(),
  cc: text('cc'),
  bcc: text('bcc'),
  replyTo: varchar('reply_to', { length: 2000 }),
  subject: varchar('subject', { length: 2000 }).notNull(),
  content: text('content'),
  plainBody: text('plain_body'),
  fromDisplayName: varchar('from_display_name', { length: 2000 }),
  status: integer('status').notNull(),
  size: integer('size').default(0),
  hasAttachments: boolean('has_attachments').default(false),
  isSigned: boolean('is_signed').default(false),
  isEncrypted: boolean('is_encrypted').default(false),
  useOnlyPlainText: boolean('use_only_plain_text').default(false),
  recipientsToggle: boolean('recipients_toggle').default(false),
  resendAttempts: integer('resend_attempts').default(0),
  lastSendError: text('last_send_error'),
  lastSendAttemptAt: timestamp('last_send_attempt_at'),
  queuedForSending: boolean('queued_for_sending').default(false),
  sentDate: timestamp('sent_date'),
  retrieveDate: timestamp('retrieve_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type EmailMessage = InferSelectModel<typeof emailMessages>;
export type NewEmailMessage = InferInsertModel<typeof emailMessages>;

export const emailMessagesRelations = relations(emailMessages, ({ one, many }) => ({
  emailAccount: one(emailAccounts, {
    fields: [emailMessages.emailAccountId],
    references: [emailAccounts.id],
  }),
  emailTemplate: one(emailTemplates, {
    fields: [emailMessages.emailTemplateId],
    references: [emailTemplates.id],
  }),
  attachments: many(emailMessageAttachments),
  headers: many(emailHeaders),
  logs: many(emailConnectorLogs),
}));

// ── Email Message Attachments (Email_Connector.Attachment) ───────────────────

export const emailMessageAttachments = pgTable('email_message_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailMessageId: uuid('email_message_id')
    .references(() => emailMessages.id, { onDelete: 'cascade' }),
  emailTemplateId: uuid('email_template_id')
    .references(() => emailTemplates.id, { onDelete: 'cascade' }),
  fileDocumentId: uuid('file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  attachmentName: varchar('attachment_name').notNull(),
  attachmentContentType: varchar('attachment_content_type').notNull(),
  attachmentSize: integer('attachment_size').default(0),
  contentId: varchar('content_id'),
  position: integer('position').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailMessageAttachment = InferSelectModel<typeof emailMessageAttachments>;
export type NewEmailMessageAttachment = InferInsertModel<typeof emailMessageAttachments>;

export const emailMessageAttachmentsRelations = relations(emailMessageAttachments, ({ one }) => ({
  emailMessage: one(emailMessages, {
    fields: [emailMessageAttachments.emailMessageId],
    references: [emailMessages.id],
  }),
  emailTemplate: one(emailTemplates, {
    fields: [emailMessageAttachments.emailTemplateId],
    references: [emailTemplates.id],
  }),
  fileDocument: one(fileDocuments, {
    fields: [emailMessageAttachments.fileDocumentId],
    references: [fileDocuments.id],
  }),
}));

// ── Email Connector Logs (Email_Connector.EmailConnectorLog) ─────────────────

export const emailConnectorLogs = pgTable('email_connector_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  emailMessageId: uuid('email_message_id')
    .references(() => emailMessages.id, { onDelete: 'set null' }),
  logType: integer('log_type').notNull(),
  message: text('message').notNull(),
  errorMessage: text('error_message'),
  stackTrace: text('stack_trace'),
  triggeredInMF: varchar('triggered_in_mf', { length: 2000 }).notNull(),
  isUnread: boolean('is_unread').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailConnectorLog = InferSelectModel<typeof emailConnectorLogs>;
export type NewEmailConnectorLog = InferInsertModel<typeof emailConnectorLogs>;

export const emailConnectorLogsRelations = relations(emailConnectorLogs, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [emailConnectorLogs.emailAccountId],
    references: [emailAccounts.id],
  }),
  emailMessage: one(emailMessages, {
    fields: [emailConnectorLogs.emailMessageId],
    references: [emailMessages.id],
  }),
}));

// ── Email Headers (Email_Connector.EmailHeader) ──────────────────────────────

export const emailHeaders = pgTable('email_headers', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailMessageId: uuid('email_message_id')
    .notNull()
    .references(() => emailMessages.id, { onDelete: 'cascade' }),
  key: varchar('key').notNull(),
  value: text('value').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailHeader = InferSelectModel<typeof emailHeaders>;
export type NewEmailHeader = InferInsertModel<typeof emailHeaders>;

export const emailHeadersRelations = relations(emailHeaders, ({ one }) => ({
  emailMessage: one(emailMessages, {
    fields: [emailHeaders.emailMessageId],
    references: [emailMessages.id],
  }),
}));

// ── Forgot Password Configuration (ForgotPassword.Configuration) ────────────

export const forgotPasswordConfigs = pgTable('forgot_password_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  signupEmailTemplateId: uuid('signup_email_template_id')
    .references(() => emailTemplates.id, { onDelete: 'set null' }),
  resetEmailTemplateId: uuid('reset_email_template_id')
    .references(() => emailTemplates.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type ForgotPasswordConfig = InferSelectModel<typeof forgotPasswordConfigs>;
export type NewForgotPasswordConfig = InferInsertModel<typeof forgotPasswordConfigs>;

export const forgotPasswordConfigsRelations = relations(forgotPasswordConfigs, ({ one }) => ({
  signupEmailTemplate: one(emailTemplates, {
    fields: [forgotPasswordConfigs.signupEmailTemplateId],
    references: [emailTemplates.id],
    relationName: 'signup_template',
  }),
  resetEmailTemplate: one(emailTemplates, {
    fields: [forgotPasswordConfigs.resetEmailTemplateId],
    references: [emailTemplates.id],
    relationName: 'reset_template',
  }),
}));

// ── Email Template Language (ForgotPassword.EmailTemplateLanguage junction) ─

export const emailTemplateLanguages = pgTable('email_template_languages', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailTemplateId: uuid('email_template_id')
    .notNull()
    .references(() => emailTemplates.id, { onDelete: 'cascade' }),
  languageId: uuid('language_id')
    .notNull()
    .references(() => systemLanguages.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailTemplateLanguage = InferSelectModel<typeof emailTemplateLanguages>;
export type NewEmailTemplateLanguage = InferInsertModel<typeof emailTemplateLanguages>;

export const emailTemplateLanguagesRelations = relations(emailTemplateLanguages, ({ one }) => ({
  emailTemplate: one(emailTemplates, {
    fields: [emailTemplateLanguages.emailTemplateId],
    references: [emailTemplates.id],
  }),
  language: one(systemLanguages, {
    fields: [emailTemplateLanguages.languageId],
    references: [systemLanguages.id],
  }),
}));

// ── Email Template SMTP (ForgotPassword.EmailTemplateSMTP junction) ──────────

export const emailTemplateSmtps = pgTable('email_template_smtps', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailTemplateId: uuid('email_template_id')
    .notNull()
    .references(() => emailTemplates.id, { onDelete: 'cascade' }),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailTemplateSmtp = InferSelectModel<typeof emailTemplateSmtps>;
export type NewEmailTemplateSmtp = InferInsertModel<typeof emailTemplateSmtps>;

export const emailTemplateSmtpsRelations = relations(emailTemplateSmtps, ({ one }) => ({
  emailTemplate: one(emailTemplates, {
    fields: [emailTemplateSmtps.emailTemplateId],
    references: [emailTemplates.id],
  }),
  emailAccount: one(emailAccounts, {
    fields: [emailTemplateSmtps.emailAccountId],
    references: [emailAccounts.id],
  }),
}));

// ── PKCS#12 Certificates (Email_Connector.Pk12Certificate) ───────────────────

export const pk12Certificates = pgTable('pk12_certificates', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  fileDocumentId: uuid('file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  passphraseEncrypted: text('passphrase_encrypted').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Pk12Certificate = InferSelectModel<typeof pk12Certificates>;
export type NewPk12Certificate = InferInsertModel<typeof pk12Certificates>;

export const pk12CertificatesRelations = relations(pk12Certificates, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [pk12Certificates.emailAccountId],
    references: [emailAccounts.id],
  }),
  fileDocument: one(fileDocuments, {
    fields: [pk12Certificates.fileDocumentId],
    references: [fileDocuments.id],
  }),
}));

// ── Email Template Export Files (Email_Connector.EmailTemplateExportFile) ────

export const emailTemplateExportFiles = pgTable('email_template_export_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileDocumentId: uuid('file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type EmailTemplateExportFile = InferSelectModel<typeof emailTemplateExportFiles>;
export type NewEmailTemplateExportFile = InferInsertModel<typeof emailTemplateExportFiles>;

export const emailTemplateExportFilesRelations = relations(emailTemplateExportFiles, ({ one }) => ({
  fileDocument: one(fileDocuments, {
    fields: [emailTemplateExportFiles.fileDocumentId],
    references: [fileDocuments.id],
  }),
}));

// ── Scheduled Event Entries (System.ScheduledEventInformation) ───────────────

export const scheduledEventEntries = pgTable('scheduled_event_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  status: integer('status').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type ScheduledEventEntry = InferSelectModel<typeof scheduledEventEntries>;
export type NewScheduledEventEntry = InferInsertModel<typeof scheduledEventEntries>;

// ── Background Job Entries (System.BackgroundJob) ────────────────────────────

export const backgroundJobEntries = pgTable('background_job_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: varchar('job_id', { length: 255 }),
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  result: text('result'),
  successful: boolean('successful').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type BackgroundJobEntry = InferSelectModel<typeof backgroundJobEntries>;
export type NewBackgroundJobEntry = InferInsertModel<typeof backgroundJobEntries>;

// ── Master Data Import/Export files (Core.MasterDataImportExport) ────────────

export const masterDataImportExport = pgTable('master_data_import_export', {
  id: uuid('id').primaryKey().defaultRandom(),
  fileDocumentId: uuid('file_document_id')
    .references(() => fileDocuments.id, { onDelete: 'set null' }),
  importType: varchar('import_type', { length: 50 }),
  status: varchar('status', { length: 50 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type MasterDataImportExport = InferSelectModel<typeof masterDataImportExport>;
export type NewMasterDataImportExport = InferInsertModel<typeof masterDataImportExport>;

export const masterDataImportExportRelations = relations(masterDataImportExport, ({ one }) => ({
  fileDocument: one(fileDocuments, {
    fields: [masterDataImportExport.fileDocumentId],
    references: [fileDocuments.id],
  }),
}));

// ── OAuth Nonces (Email_Connector.OAuthNonce) ────────────────────────────────

export const oauthNonces = pgTable('oauth_nonces', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  state: varchar('state', { length: 2000 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type OAuthNonce = InferSelectModel<typeof oauthNonces>;
export type NewOAuthNonce = InferInsertModel<typeof oauthNonces>;

export const oauthNoncesRelations = relations(oauthNonces, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [oauthNonces.emailAccountId],
    references: [emailAccounts.id],
  }),
}));

// ── Email_Connector OAuth Tokens ─────────────────────────────────────────────

export const emailConnectorOAuthTokens = pgTable('email_connector_oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  emailAccountId: uuid('email_account_id')
    .notNull()
    .references(() => emailAccounts.id, { onDelete: 'cascade' }),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  tokenType: varchar('token_type', { length: 2000 }).notNull(),
  scope: varchar('scope', { length: 2000 }).notNull(),
  expiresIn: integer('expires_in').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type EmailConnectorOAuthToken = InferSelectModel<typeof emailConnectorOAuthTokens>;
export type NewEmailConnectorOAuthToken = InferInsertModel<typeof emailConnectorOAuthTokens>;

export const emailConnectorOAuthTokensRelations = relations(emailConnectorOAuthTokens, ({ one }) => ({
  emailAccount: one(emailAccounts, {
    fields: [emailConnectorOAuthTokens.emailAccountId],
    references: [emailAccounts.id],
  }),
}));
