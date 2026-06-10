ALTER TABLE "pgp_certificates" ADD COLUMN "file_document_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_keys" ADD COLUMN "used_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_keys" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_keys" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "pgp_certificates" ADD CONSTRAINT "pgp_certificates_file_document_id_file_documents_id_fk" FOREIGN KEY ("file_document_id") REFERENCES "public"."file_documents"("id") ON DELETE set null ON UPDATE no action;