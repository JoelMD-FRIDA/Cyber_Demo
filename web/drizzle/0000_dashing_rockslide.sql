CREATE TYPE "public"."certificate_type" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "activation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid" uuid NOT NULL,
	"fullname" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"confirmation_link" varchar(2048),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activation_requests_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_url" varchar(2048) NOT NULL,
	"oauth_url" varchar(2048),
	"username" varchar(255),
	"password_encrypted" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text,
	"maximum_number_of_checks" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "background_job_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(255),
	"start_time" timestamp,
	"end_time" timestamp,
	"result" text,
	"successful" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_check_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_check_categories_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "domain_check_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uuid" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"website_url" varchar(2048),
	"description" text,
	"short_description" varchar(700),
	"long_description" varchar(2000),
	"api_base_url" varchar(200),
	"api_key_encrypted" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_check_providers_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "domain_check_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_check_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"results_pw_leaks" integer DEFAULT 0,
	"results_email_leaks" integer DEFAULT 0,
	"results_eol_software" integer DEFAULT 0,
	"results_open_ports" integer DEFAULT 0,
	"results_spf_record" boolean DEFAULT false,
	"has_spf_record_result" boolean DEFAULT false,
	"has_darknet_results" boolean DEFAULT false,
	"has_software_results" boolean DEFAULT false,
	"has_open_ports_results" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domain_check_results_domain_check_id_unique" UNIQUE("domain_check_id")
);
--> statement-breakpoint
CREATE TABLE "domain_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"url" varchar(2048) NOT NULL,
	"status" varchar(50),
	"results" jsonb,
	"has_accepted_disclaimer" boolean DEFAULT false,
	"disclaimer_accepted_at" timestamp,
	"disclaimer_version" varchar(20),
	"provider_count" integer DEFAULT 0,
	"remaining_domain_checks" integer DEFAULT 0,
	"max_checks" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mail_address" varchar(2000) NOT NULL,
	"username" varchar(2000) NOT NULL,
	"password_encrypted" text NOT NULL,
	"from_display_name" varchar(2000) NOT NULL,
	"timeout" integer DEFAULT 20000,
	"is_shared_mailbox" boolean DEFAULT false,
	"is_p12_configured" boolean DEFAULT false,
	"is_oauth_used" boolean DEFAULT false,
	"is_ldap_configured" boolean DEFAULT false,
	"is_outgoing_email_configured" boolean DEFAULT false,
	"is_incoming_email_configured" boolean DEFAULT false,
	"sanitize_email_body_for_xss" boolean DEFAULT false,
	"is_email_config_auto_detect" boolean DEFAULT true,
	"use_ssl_check_server_identity" boolean DEFAULT false,
	"ldap_configuration_id" uuid,
	"oauth_provider_id" uuid,
	"oauth_token_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_connector_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid,
	"email_message_id" uuid,
	"log_type" integer NOT NULL,
	"message" text NOT NULL,
	"error_message" text,
	"stack_trace" text,
	"triggered_in_mf" varchar(2000) NOT NULL,
	"is_unread" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_connector_oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"id_token" text,
	"token_type" varchar(2000) NOT NULL,
	"scope" varchar(2000) NOT NULL,
	"expires_in" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_headers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_message_id" uuid NOT NULL,
	"key" varchar NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_message_id" uuid,
	"email_template_id" uuid,
	"file_document_id" uuid,
	"attachment_name" varchar NOT NULL,
	"attachment_content_type" varchar NOT NULL,
	"attachment_size" integer DEFAULT 0,
	"content_id" varchar,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"email_template_id" uuid,
	"from" varchar(2000) NOT NULL,
	"to" text NOT NULL,
	"cc" text,
	"bcc" text,
	"reply_to" varchar(2000),
	"subject" varchar(2000) NOT NULL,
	"content" text,
	"plain_body" text,
	"from_display_name" varchar(2000),
	"status" integer NOT NULL,
	"size" integer DEFAULT 0,
	"has_attachments" boolean DEFAULT false,
	"is_signed" boolean DEFAULT false,
	"is_encrypted" boolean DEFAULT false,
	"use_only_plain_text" boolean DEFAULT false,
	"recipients_toggle" boolean DEFAULT false,
	"resend_attempts" integer DEFAULT 0,
	"last_send_error" text,
	"last_send_attempt_at" timestamp,
	"queued_for_sending" boolean DEFAULT false,
	"sent_date" timestamp,
	"retrieve_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"status" "email_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "email_template_export_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_template_id" uuid NOT NULL,
	"language_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_template_smtps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_template_id" uuid NOT NULL,
	"email_account_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"subject" varchar(500) NOT NULL,
	"body" text NOT NULL,
	"from_address" varchar(2000),
	"from_display_name" varchar(2000),
	"reply_to" varchar(2000),
	"bcc" text,
	"cc" text,
	"plain_body" text,
	"to" text,
	"has_attachment" boolean DEFAULT false,
	"signed" boolean DEFAULT false,
	"encrypted" boolean DEFAULT false,
	"use_only_plain_text" boolean DEFAULT false,
	"template_name" varchar(2000),
	"sent_date" timestamp,
	"recipients_toggle" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "file_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(400) NOT NULL,
	"mime_type" varchar(255),
	"size" integer DEFAULT -1,
	"has_contents" boolean DEFAULT false,
	"content" "bytea",
	"reference" varchar(255),
	"reference_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forgot_password_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signup_email_template_id" uuid,
	"reset_email_template_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forgot_password_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_address" varchar(255) NOT NULL,
	"username" varchar(255),
	"user_full_name" varchar(255),
	"guid" varchar(255) NOT NULL,
	"url" varchar(2048),
	"valid_until" timestamp,
	"is_signup" boolean DEFAULT false NOT NULL,
	CONSTRAINT "forgot_password_requests_guid_unique" UNIQUE("guid")
);
--> statement-breakpoint
CREATE TABLE "incoming_email_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"server_host" varchar(2000) NOT NULL,
	"server_port" integer DEFAULT 0,
	"incoming_protocol" integer NOT NULL,
	"folder" varchar(2000) DEFAULT 'INBOX',
	"batch_size" integer DEFAULT 50,
	"fetch_strategy" integer,
	"handling" integer,
	"move_folder" varchar(2000),
	"process_inline_image" boolean DEFAULT false,
	"notify_on_new_emails" boolean DEFAULT false,
	"use_batch_import" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ldap_configurations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ldap_host" varchar(2000) NOT NULL,
	"ldap_port" integer DEFAULT 389,
	"ldap_username" varchar(2000) NOT NULL,
	"ldap_password_encrypted" text NOT NULL,
	"base_dn" varchar(2000) NOT NULL,
	"auth_type" integer,
	"is_ssl" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_data_import_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_document_id" uuid,
	"import_type" varchar(50),
	"status" varchar(50) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"state" varchar(2000) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(2000) NOT NULL,
	"oauth_type" integer NOT NULL,
	"authorization_endpoint" varchar(2000) NOT NULL,
	"token_endpoint" varchar(2000) NOT NULL,
	"client_id" varchar(2000) NOT NULL,
	"client_secret_encrypted" text NOT NULL,
	"tenant_id" varchar(2000),
	"email_domain" varchar(2000) NOT NULL,
	"callback_url" varchar(2000) NOT NULL,
	"callback_operation_path" varchar(2000) NOT NULL,
	"open_id_well_known_metadata_uri" varchar(2000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_token" text NOT NULL,
	"expires_in" integer,
	"refresh_expires_in" integer,
	"token_type" varchar(50),
	"scope" varchar(2048),
	"expiry_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "outgoing_email_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"server_host" varchar(2000) NOT NULL,
	"server_port" integer DEFAULT 0,
	"outgoing_protocol" integer NOT NULL,
	"ssl" boolean DEFAULT false,
	"tls" boolean DEFAULT false,
	"send_max_attempts" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pgp_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_type" "certificate_type" NOT NULL,
	"passphrase_encrypted" text,
	"reference" varchar(255),
	"email_address" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pk12_certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_account_id" uuid NOT NULL,
	"file_document_id" uuid,
	"passphrase_encrypted" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(255) NOT NULL,
	"company_domain" varchar(255),
	"total_slots" integer NOT NULL,
	"company" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registration_keys_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "scheduled_event_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"start_time" timestamp,
	"end_time" timestamp,
	"status" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" varchar(200) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "system_languages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"firstname" varchar(255),
	"lastname" varchar(255),
	"company" varchar(255),
	"performed_domain_checks" integer DEFAULT 0 NOT NULL,
	"is_activated" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"password_hash" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "domain_check_results" ADD CONSTRAINT "domain_check_results_domain_check_id_domain_checks_id_fk" FOREIGN KEY ("domain_check_id") REFERENCES "public"."domain_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_check_results" ADD CONSTRAINT "domain_check_results_category_id_domain_check_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."domain_check_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_checks" ADD CONSTRAINT "domain_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_checks" ADD CONSTRAINT "domain_checks_provider_id_domain_check_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."domain_check_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_checks" ADD CONSTRAINT "domain_checks_category_id_domain_check_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."domain_check_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_ldap_configuration_id_ldap_configurations_id_fk" FOREIGN KEY ("ldap_configuration_id") REFERENCES "public"."ldap_configurations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_oauth_provider_id_oauth_providers_id_fk" FOREIGN KEY ("oauth_provider_id") REFERENCES "public"."oauth_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_oauth_token_id_oauth_tokens_id_fk" FOREIGN KEY ("oauth_token_id") REFERENCES "public"."oauth_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connector_logs" ADD CONSTRAINT "email_connector_logs_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connector_logs" ADD CONSTRAINT "email_connector_logs_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_connector_oauth_tokens" ADD CONSTRAINT "email_connector_oauth_tokens_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_headers" ADD CONSTRAINT "email_headers_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message_attachments" ADD CONSTRAINT "email_message_attachments_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message_attachments" ADD CONSTRAINT "email_message_attachments_email_template_id_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message_attachments" ADD CONSTRAINT "email_message_attachments_file_document_id_file_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."file_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_template_id_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_export_files" ADD CONSTRAINT "email_template_export_files_file_document_id_file_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."file_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_languages" ADD CONSTRAINT "email_template_languages_email_template_id_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_languages" ADD CONSTRAINT "email_template_languages_language_id_system_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."system_languages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_smtps" ADD CONSTRAINT "email_template_smtps_email_template_id_email_templates_id_fk" FOREIGN KEY ("email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_template_smtps" ADD CONSTRAINT "email_template_smtps_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forgot_password_configs" ADD CONSTRAINT "forgot_password_configs_signup_email_template_id_email_templates_id_fk" FOREIGN KEY ("signup_email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forgot_password_configs" ADD CONSTRAINT "forgot_password_configs_reset_email_template_id_email_templates_id_fk" FOREIGN KEY ("reset_email_template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incoming_email_configs" ADD CONSTRAINT "incoming_email_configs_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_data_import_export" ADD CONSTRAINT "master_data_import_export_file_document_id_file_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."file_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_nonces" ADD CONSTRAINT "oauth_nonces_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outgoing_email_configs" ADD CONSTRAINT "outgoing_email_configs_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pk12_certificates" ADD CONSTRAINT "pk12_certificates_email_account_id_email_accounts_id_fk" FOREIGN KEY ("email_account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pk12_certificates" ADD CONSTRAINT "pk12_certificates_file_document_id_file_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."file_documents"("id") ON DELETE set null ON UPDATE no action;