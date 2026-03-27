import { useState, useEffect } from 'react';
import { useSectors } from '../../context/SectorContext.jsx';
import { apiFetch, buildUrl } from '../../hooks/useApi.js';
import PageHeader from '../../components/PageHeader.jsx';
import AiBadge from '../../components/AiBadge.jsx';
import DocumentUpload from '../../components/DocumentUpload.jsx';

export default function TrainingMaterials() {
  const { selectedSectorId } = useSectors();
  const [courses, setCourses] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [knowledgeStats, setKnowledgeStats] = useState(null);
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState('');

  function load() {
    apiFetch(buildUrl('/courses', selectedSectorId)).then(setCourses).catch(() => setCourses([]));
    apiFetch('/uploads?entity_type=training_material').then(setUploads).catch(() => setUploads([]));
    apiFetch('/knowledge/stats').then(setKnowledgeStats).catch(() => {});
  }

  useEffect(load, [selectedSectorId]);

  async function trainOnAllMaterials() {
    setTraining(true);
    setTrainResult('');
    try {
      const result = await apiFetch('/knowledge/train-from-materials', {
        method: 'POST',
        timeout: 300000,
      });
      setTrainResult(`Trained on ${result.processed} items. ${result.newEntries} new knowledge entries created.`);
      load();
    } catch (err) {
      setTrainResult('Training failed: ' + err.message);
    } finally {
      setTraining(false);
    }
  }

  return (
    <div>
      <PageHeader title="Training Materials">
        <AiBadge />
      </PageHeader>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
        Upload past course materials, slides, documents, and recordings. Holly's AI learns from these to generate better courses and recommendations.
      </p>

      {/* Knowledge stats */}
      {knowledgeStats && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div className="card" style={{ padding: 16, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{knowledgeStats.total || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Knowledge Entries</div>
          </div>
          <div className="card" style={{ padding: 16, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{knowledgeStats.fromCurriculum || 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>From Curriculum</div>
          </div>
          <div className="card" style={{ padding: 16, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{courses.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Courses</div>
          </div>
          <div className="card" style={{ padding: 16, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{uploads.length}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Uploaded Files</div>
          </div>
        </div>
      )}

      {/* Train AI button */}
      <div className="card" style={{ padding: 20, marginBottom: 24, borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Train AI on Course Materials</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Processes all uploaded documents, course modules, and trainer feedback into the knowledge base so Holly's AI can reference them when building new courses.
            </div>
          </div>
          <button className="btn btn-primary" onClick={trainOnAllMaterials} disabled={training}>
            {training ? 'Training...' : 'Train Now'}
          </button>
        </div>
        {trainResult && (
          <div style={{ marginTop: 12, padding: 10, background: '#F1F5F9', borderRadius: 6, fontSize: 13 }}>
            {trainResult}
          </div>
        )}
      </div>

      {/* Upload section */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Upload Materials</h3>
        <DocumentUpload entityType="training_material" onUploaded={load} />
      </div>

      {/* Existing courses as material sources */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Existing Courses</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        These courses and their modules are automatically included when you train the AI.
      </p>
      {courses.length === 0 ? (
        <div className="empty-state"><h3>No courses yet.</h3></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Course</th><th>Modules</th><th>Status</th><th>Effectiveness</th></tr>
          </thead>
          <tbody>
            {courses.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.title}</td>
                <td>{c.module_count || 0} modules</td>
                <td><span className={`stage-badge status-${c.status}`}>{c.status}</span></td>
                <td>{c.effectiveness_score ? `${c.effectiveness_score}/5` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Uploaded files list */}
      {uploads.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Uploaded Files</h3>
          <table className="data-table">
            <thead>
              <tr><th>File</th><th>Type</th><th>Uploaded</th></tr>
            </thead>
            <tbody>
              {uploads.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.original_name}</td>
                  <td>{u.mime_type?.split('/').pop() || '—'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
