import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";

import ReportBuilder from "./pages/ReportBuilder";
import SavedReports from "./pages/SavedReports";
import Users from "./pages/Users";
import Teams from "./pages/Teams";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import PipelineBoard from "./pages/PipelineBoard";
import PipelineAdvancedSearch from "./pages/PipelineAdvancedSearch";
import Reports from "./pages/Reports";
import ApprovalMatrix from "./pages/ApprovalMatrix";
import Designations from "./pages/Designations";
import Connectors from "./pages/Connectors";
import CallingDashboard from "./pages/CallingDashboard";
import CallLogs from "./pages/CallLogs";
import ExotelSettings from "./pages/ExotelSettings";
import PublicForm from "./pages/PublicForm";
import PublicLoanApplication from "./pages/PublicLoanApplication";

import WhatsAppSettings from "./pages/WhatsAppSettings";
import Templates from "./pages/Templates";
import TemplateBuilder from "./pages/TemplateBuilder";
import WhatsAppDashboard from "./pages/WhatsAppDashboard";
import BulkWhatsAppSender from "./pages/BulkWhatsAppSender";
import EmailSettings from "./pages/EmailSettings";
import WhatsAppCampaigns from "./pages/WhatsAppCampaigns";
import WhatsAppCampaignDetail from "./pages/WhatsAppCampaignDetail";
import QueueStatus from "./pages/QueueStatus";
import Communications from "./pages/Communications";
import BulkEmailSender from "./pages/BulkEmailSender";
import EmailCampaigns from "./pages/EmailCampaigns";
import EmailCampaignDetail from "./pages/EmailCampaignDetail";
import EmailAutomations from "./pages/EmailAutomations";
import EmailAutomationSettings from "./pages/EmailAutomationSettings";
import CampaignOverview from "./pages/Campaigns/CampaignOverview";
import AIInsightsDashboard from "./pages/Campaigns/AIInsightsDashboard";
import RedefineDataRepository from "./pages/RedefineDataRepository";
import Inventory from "./pages/Inventory";
import OutboundWebhooks from "./pages/OutboundWebhooks";
import Tasks from "./pages/Tasks";
import Applications from "./pages/LOS/Applications";
// NewApplication import removed - applications only via referral links
import ApplicationDetail from "./pages/LOS/ApplicationDetail";
import ApprovalQueuePage from "./pages/LOS/ApprovalQueue";
import LOSDashboard from "./pages/LOS/Dashboard";
import MyReferrals from "./pages/LOS/MyReferrals";
import Collections from "./pages/LOS/Collections";
import CustomerRelationships from "./pages/LOS/CustomerRelationships";
import Sanctions from "./pages/LOS/Sanctions";
import SanctionDetail from "./pages/LOS/SanctionDetail";
import Disbursals from "./pages/LOS/Disbursals";
import ReferralLoanApplication from "./pages/ReferralLoanApplication";
import NegativePinCodes from "./pages/NegativePinCodes";
import Profile from "./pages/Profile";
import ESignDocument from "./pages/ESignDocument";
import VideoKYC from "./pages/VideoKYC";
import DigilockerSuccess from "./pages/DigilockerSuccess";
import DigilockerFailure from "./pages/DigilockerFailure";
import ProtectedRoute from "./components/Auth/ProtectedRoute";

console.log('[App] Module loaded, all imports successful');

const App = () => {
  console.log('[App] App component rendering...');
  
  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/form/:formId" element={<PublicForm />} />
            <Route path="/apply/:slug" element={<PublicLoanApplication />} />
            <Route path="/apply/ref/:referralCode" element={<ReferralLoanApplication />} />
            <Route path="/esign/:token" element={<ESignDocument />} />
            <Route path="/videokyc/:token" element={<VideoKYC />} />
            <Route path="/digilocker/success" element={<DigilockerSuccess />} />
            <Route path="/digilocker/failure" element={<DigilockerFailure />} />
            
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/contacts" element={
              <ProtectedRoute>
                <Contacts />
              </ProtectedRoute>
            } />
            
            <Route path="/contacts/:id" element={
              <ProtectedRoute>
                <ContactDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/pipeline" element={
              <ProtectedRoute>
                <PipelineBoard />
              </ProtectedRoute>
            } />
            
            <Route path="/pipeline/advanced-search" element={
              <ProtectedRoute>
                <PipelineAdvancedSearch />
              </ProtectedRoute>
            } />
            
            <Route path="/reports" element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            } />
            
            <Route path="/calling-dashboard" element={
              <ProtectedRoute>
                <CallingDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/call-logs" element={
              <ProtectedRoute>
                <CallLogs />
              </ProtectedRoute>
            } />
            
            <Route path="/exotel-settings" element={
              <ProtectedRoute requiredRole="admin">
                <ExotelSettings />
              </ProtectedRoute>
            } />
            
            <Route path="/users" element={
              <ProtectedRoute requiredRole="admin">
                <Users />
              </ProtectedRoute>
            } />
            
            <Route path="/teams" element={
              <ProtectedRoute requiredRole="admin">
                <Teams />
              </ProtectedRoute>
            } />
            
            
            
            <Route path="/admin/approval-matrix" element={
              <ProtectedRoute requiredRole="admin">
                <ApprovalMatrix />
              </ProtectedRoute>
            } />
            
            <Route path="/admin/designations" element={
              <ProtectedRoute requiredRole="admin">
                <Designations />
              </ProtectedRoute>
            } />
            
            
            <Route path="/admin/connectors" element={
              <ProtectedRoute requiredRole="admin">
                <Connectors />
              </ProtectedRoute>
            } />
            
            
            <Route path="/admin/outbound-webhooks" element={
              <ProtectedRoute requiredRole="admin">
                <OutboundWebhooks />
              </ProtectedRoute>
            } />
            
            <Route path="/whatsapp-settings" element={
              <ProtectedRoute requiredRole="admin">
                <WhatsAppSettings />
              </ProtectedRoute>
            } />
            
            <Route path="/templates" element={
              <ProtectedRoute>
                <Templates />
              </ProtectedRoute>
            } />
            
            <Route path="/templates/create" element={
              <ProtectedRoute>
                <TemplateBuilder />
              </ProtectedRoute>
            } />
            
            <Route path="/whatsapp-messages" element={
              <ProtectedRoute>
                <WhatsAppDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/whatsapp/bulk-send" element={
              <ProtectedRoute>
                <BulkWhatsAppSender />
              </ProtectedRoute>
            } />
            
            <Route path="/whatsapp/campaigns" element={
              <ProtectedRoute>
                <WhatsAppCampaigns />
              </ProtectedRoute>
            } />
            
            <Route path="/whatsapp/campaigns/:id" element={
              <ProtectedRoute>
                <WhatsAppCampaignDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/queue-status" element={
              <ProtectedRoute>
                <QueueStatus />
              </ProtectedRoute>
            } />
            
            <Route path="/communications" element={
              <ProtectedRoute>
                <Communications />
              </ProtectedRoute>
            } />
            
            <Route path="/bulk-email" element={
              <ProtectedRoute>
                <BulkEmailSender />
              </ProtectedRoute>
            } />
            
            <Route path="/email-campaigns" element={
              <ProtectedRoute>
                <EmailCampaigns />
              </ProtectedRoute>
            } />
            
            <Route path="/email-campaigns/:id" element={
              <ProtectedRoute>
                <EmailCampaignDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/email-automations" element={
              <ProtectedRoute requiredRole="admin">
                <EmailAutomations />
              </ProtectedRoute>
            } />
            
            <Route path="/email-automations/settings" element={
              <ProtectedRoute requiredRole="admin">
                <EmailAutomationSettings />
              </ProtectedRoute>
            } />
            
            <Route path="/campaigns/overview" element={
              <ProtectedRoute>
                <CampaignOverview />
              </ProtectedRoute>
            } />
            
            <Route path="/campaigns/insights" element={
              <ProtectedRoute>
                <AIInsightsDashboard />
              </ProtectedRoute>
            } />
            
            
            <Route path="/redefine-repository" element={
              <ProtectedRoute>
                <RedefineDataRepository />
              </ProtectedRoute>
            } />
            
            <Route path="/inventory" element={
              <ProtectedRoute>
                <Inventory />
              </ProtectedRoute>
            } />
            
            <Route path="/tasks" element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            } />
            
            <Route path="/los/dashboard" element={
              <ProtectedRoute>
                <LOSDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/los/applications" element={
              <ProtectedRoute>
                <Applications />
              </ProtectedRoute>
            } />
            
            {/* NewApplication route removed - applications only via referral links */}
            
            <Route path="/los/applications/:id" element={
              <ProtectedRoute>
                <ApplicationDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/los/approval-queue" element={
              <ProtectedRoute>
                <ApprovalQueuePage />
              </ProtectedRoute>
            } />
            
            <Route path="/los/sanctions" element={
              <ProtectedRoute>
                <Sanctions />
              </ProtectedRoute>
            } />
            
            <Route path="/los/sanctions/:id" element={
              <ProtectedRoute>
                <SanctionDetail />
              </ProtectedRoute>
            } />
            
            <Route path="/los/disbursals" element={
              <ProtectedRoute>
                <Disbursals />
              </ProtectedRoute>
            } />
            
            <Route path="/los/my-referrals" element={
              <ProtectedRoute>
                <MyReferrals />
              </ProtectedRoute>
            } />
            
            <Route path="/los/collections" element={
              <ProtectedRoute>
                <Collections />
              </ProtectedRoute>
            } />
            
            <Route path="/los/relationships" element={
              <ProtectedRoute>
                <CustomerRelationships />
              </ProtectedRoute>
            } />
            
            <Route path="/los/negative-pincodes" element={
              <ProtectedRoute requiredRole="admin">
                <NegativePinCodes />
              </ProtectedRoute>
            } />
            
            <Route path="/reports/builder" element={
              <ProtectedRoute>
                <ReportBuilder />
              </ProtectedRoute>
            } />
            
            <Route path="/reports/saved" element={
              <ProtectedRoute>
                <SavedReports />
              </ProtectedRoute>
            } />
            
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
  );
};

console.log('[App] App component defined');

export default App;
