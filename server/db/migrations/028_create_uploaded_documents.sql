CREATE TABLE uploaded_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL,
  file_path VARCHAR(1000) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  sector_id UUID REFERENCES sectors(id),
  extracted_text TEXT,
  extraction_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  extraction_error TEXT,
  ai_summary TEXT,
  ai_extracted_data JSONB,
  ai_analysis_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  uploaded_by UUID REFERENCES team_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploaded_documents_entity ON uploaded_documents(entity_type, entity_id);
CREATE INDEX idx_uploaded_documents_sector ON uploaded_documents(sector_id);
