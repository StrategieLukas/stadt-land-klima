-- Initialize agreement versions table with default values
-- This should be run once to set up the initial versions

INSERT INTO agreement_versions (id, current_agb_version, current_data_protection_version)
VALUES ('00000000-0000-0000-0000-000000000000', '1.0', '1.0')
ON CONFLICT (id) DO NOTHING;