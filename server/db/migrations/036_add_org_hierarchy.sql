-- Add funder/client hierarchy to organisations
-- relationship_type: 'funder' (pays you), 'programme_org' (assigned by funder), 'lead' (prospective), 'direct_client' (pays you directly)
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50) DEFAULT 'lead';
-- Link programme orgs back to their funder
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS funder_organisation_id UUID REFERENCES organisations(id);
-- Which programme this org is part of (e.g. 'TRF', 'DNTF', 'ZIMZAM')
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS programme_name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_organisations_relationship_type ON organisations(relationship_type);
CREATE INDEX IF NOT EXISTS idx_organisations_funder ON organisations(funder_organisation_id);
