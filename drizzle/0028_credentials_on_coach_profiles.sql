-- Add credentials JSONB column to coach_profiles
-- Shape: Array<{ id, type, title, issuer, issuedYear, expiresYear?, credentialId?, verificationUrl?, documentUrl?, verifiedAt?, verifiedBy? }>

ALTER TABLE "coach_profiles" ADD COLUMN "credentials" jsonb DEFAULT '[]'::jsonb;
