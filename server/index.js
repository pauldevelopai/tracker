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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sectors', requireAuth, sectorRoutes);
app.use('/api/contacts', requireAuth, sectorFilter, contactRoutes);
app.use('/api/organisations', requireAuth, sectorFilter, organisationRoutes);
app.use('/api/team-members', requireAuth, requireRole('admin'), teamMemberRoutes);
app.use('/api/cohorts', requireAuth, sectorFilter, cohortRoutes);
app.use('/api/needs-assessments', requireAuth, sectorFilter, needsAssessmentRoutes);
app.use('/api/assessment-questions', requireAuth, assessmentQuestionRoutes);
app.use('/api/courses', requireAuth, sectorFilter, courseRoutes);
app.use('/api/document-templates', requireAuth, documentTemplateRoutes);
app.use('/api/generated-documents', requireAuth, sectorFilter, generatedDocumentRoutes);
app.use('/api/service-engagements', requireAuth, sectorFilter, serviceEngagementRoutes);
app.use('/api/outreach-campaigns', requireAuth, sectorFilter, outreachCampaignRoutes);
app.use('/api/outreach-messages', requireAuth, outreachMessageRoutes);
app.use('/api/social-posts', requireAuth, sectorFilter, socialPostRoutes);
app.use('/api/gmail', requireAuth, gmailRoutes);
app.use('/api/funders', requireAuth, funderRoutes);
app.use('/api/funding-opportunities', requireAuth, sectorFilter, fundingOpportunityRoutes);
app.use('/api/dashboard', requireAuth, sectorFilter, dashboardRoutes);
app.use('/api/ai-assistant', requireAuth, aiAssistantRoutes);
app.use('/api/background-jobs', requireAuth, requireRole('admin'), backgroundJobRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/knowledge', requireAuth, knowledgeRoutes);
app.use('/api/uploads', requireAuth, uploadRoutes);
app.use('/api/intelligence', requireAuth, intelligenceRoutes);
app.use('/api/newsletter', requireAuth, newsletterRoutes);
app.use('/api/lawsuits', requireAuth, lawsuitRoutes);
app.use('/api/learning-outcomes', requireAuth, learningOutcomeRoutes);
app.use('/api/learning-tasks', requireAuth, learningTaskRoutes);
app.use('/api/learning-journeys', requireAuth, sectorFilter, learningJourneyRoutes);
app.use('/api/participant-tokens', requireAuth, requireRole('admin'), participantTokenRoutes);
app.use('/api/portal', participantPortalRoutes); // Public — token-authenticated
app.use('/api/agent-conversations', requireAuth, agentConversationRoutes);
app.use('/api/agent-actions', requireAuth, agentActionRoutes);
app.use('/api/feedback', requireAuth, feedbackRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`Holly server running on port ${config.port}`);
  startScheduler();
});
