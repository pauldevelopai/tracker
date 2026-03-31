import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import config from './config.js';
import authRoutes from './routes/auth.js';
import sectorRoutes from './routes/sectors.js';
import contactRoutes from './routes/contacts.js';
import organisationRoutes from './routes/organisations.js';
import teamMemberRoutes from './routes/team-members.js';
import cohortRoutes from './routes/cohorts.js';
import needsAssessmentRoutes from './routes/needs-assessments.js';
import assessmentQuestionRoutes from './routes/assessment-questions.js';
import courseRoutes from './routes/courses.js';
import documentTemplateRoutes from './routes/document-templates.js';
import generatedDocumentRoutes from './routes/generated-documents.js';
import serviceEngagementRoutes from './routes/service-engagements.js';
import outreachCampaignRoutes from './routes/outreach-campaigns.js';
import outreachMessageRoutes from './routes/outreach-messages.js';
import socialPostRoutes from './routes/social-posts.js';
import gmailRoutes from './routes/gmail.js';
import funderRoutes from './routes/funders.js';
import fundingOpportunityRoutes from './routes/funding-opportunities.js';
import dashboardRoutes from './routes/dashboard.js';
import aiAssistantRoutes from './routes/ai-assistant.js';
import backgroundJobRoutes from './routes/background-jobs.js';
import notificationRoutes from './routes/notifications.js';
import knowledgeRoutes from './routes/knowledge.js';
import uploadRoutes from './routes/uploads.js';
import intelligenceRoutes from './routes/intelligence.js';
import newsletterRoutes from './routes/newsletter.js';
import learningOutcomeRoutes from './routes/learning-outcomes.js';
import learningTaskRoutes from './routes/learning-tasks.js';
import learningJourneyRoutes from './routes/learning-journeys.js';
import participantPortalRoutes from './routes/participant-portal.js';
import participantTokenRoutes from './routes/participant-tokens.js';
import agentConversationRoutes from './routes/agent-conversations.js';
import agentActionRoutes from './routes/agent-actions.js';
import feedbackRoutes from './routes/feedback.js';
import lawsuitRoutes from './routes/lawsuits.js';
import { startScheduler } from './services/scheduler.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { sectorFilter } from './middleware/sector-filter.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Open / limited-access endpoints ───────────────────────────────────────────
// Auth: anyone
app.use('/api/auth', authRoutes);
// Participant portal: public, token-authenticated
app.use('/api/portal', participantPortalRoutes);
// Lawsuits: all authenticated users (admin + member roles)
app.use('/api/lawsuits', requireAuth, lawsuitRoutes);
// AI chatbot: all authenticated users
app.use('/api/ai-assistant', requireAuth, aiAssistantRoutes);
// Feedback: all authenticated users can submit; admin can view/manage
app.use('/api/feedback', requireAuth, feedbackRoutes);

// ── Admin-only endpoints ───────────────────────────────────────────────────────
// All routes below this point require role = 'admin'.
const admin = express.Router();
admin.use(requireAuth);
admin.use(requireRole('admin'));

admin.use('/sectors',              sectorRoutes);
admin.use('/contacts',             sectorFilter, contactRoutes);
admin.use('/organisations',        sectorFilter, organisationRoutes);
admin.use('/team-members',         teamMemberRoutes);
admin.use('/cohorts',              sectorFilter, cohortRoutes);
admin.use('/needs-assessments',    sectorFilter, needsAssessmentRoutes);
admin.use('/assessment-questions', assessmentQuestionRoutes);
admin.use('/courses',              sectorFilter, courseRoutes);
admin.use('/document-templates',   documentTemplateRoutes);
admin.use('/generated-documents',  sectorFilter, generatedDocumentRoutes);
admin.use('/service-engagements',  sectorFilter, serviceEngagementRoutes);
admin.use('/outreach-campaigns',   sectorFilter, outreachCampaignRoutes);
admin.use('/outreach-messages',    outreachMessageRoutes);
admin.use('/social-posts',         sectorFilter, socialPostRoutes);
admin.use('/gmail',                gmailRoutes);
admin.use('/funders',              funderRoutes);
admin.use('/funding-opportunities', sectorFilter, fundingOpportunityRoutes);
admin.use('/dashboard',            sectorFilter, dashboardRoutes);
admin.use('/background-jobs',      backgroundJobRoutes);
admin.use('/notifications',        notificationRoutes);
admin.use('/knowledge',            knowledgeRoutes);
admin.use('/uploads',              uploadRoutes);
admin.use('/intelligence',         intelligenceRoutes);
admin.use('/newsletter',           newsletterRoutes);
admin.use('/learning-outcomes',    learningOutcomeRoutes);
admin.use('/learning-tasks',       learningTaskRoutes);
admin.use('/learning-journeys',    sectorFilter, learningJourneyRoutes);
admin.use('/participant-tokens',   participantTokenRoutes);
admin.use('/agent-conversations',  agentConversationRoutes);
admin.use('/agent-actions',        agentActionRoutes);

app.use('/api', admin);

// ── Error handler ──────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Holly server running on port ${config.port}`);
  startScheduler();
});
