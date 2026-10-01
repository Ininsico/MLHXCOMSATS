import { MotionConfig } from 'framer-motion'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import GuestOnly from './components/GuestOnly'
import RequireRole from './components/RequireRole'
import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import ExplorePage from './pages/ExplorePage'
import HospitalDetailPage from './pages/HospitalDetailPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import HospitalSignInPage from './pages/HospitalSignInPage'
import HospitalApplyPage from './pages/HospitalApplyPage'
import HospitalPendingPage from './pages/HospitalPendingPage'
import ContactPage from './pages/ContactPage'
import FeaturesPage from './pages/FeaturesPage'
import HowItWorksPage from './pages/HowItWorksPage'
import ForHospitalsPage from './pages/ForHospitalsPage'
import HospitalLayout from './pages/hospital/HospitalLayout'
import HospitalOverviewPage from './pages/hospital/HospitalOverviewPage'
import HospitalProfilePage from './pages/hospital/HospitalProfilePage'
import HospitalSettingsPage from './pages/hospital/HospitalSettingsPage'
import HospitalAppointmentsPage from './pages/hospital/HospitalAppointmentsPage'
import HospitalDoctorsPage from './pages/hospital/HospitalDoctorsPage'
import HospitalLabPage from './pages/hospital/HospitalLabPage'
import HospitalInventoryPage from './pages/hospital/HospitalInventoryPage'
import HospitalMarketplacePage from './pages/hospital/HospitalMarketplacePage'
import HospitalPublicPage from './pages/hospital/HospitalPublicPagePage'
import HospitalVerificationPage from './pages/hospital/HospitalVerificationPage'
import HospitalFleetPage from './pages/hospital/HospitalFleetPage'
import HospitalOperationsPage from './pages/hospital/HospitalOperationsPage'
import PatientLayout from './pages/patient/PatientLayout'
import PatientOverviewPage from './pages/patient/PatientOverviewPage'
import PatientSettingsPage from './pages/patient/PatientSettingsPage'
import PatientAppointmentsPage from './pages/patient/PatientAppointmentsPage'
import PatientLabPage from './pages/patient/PatientLabPage'
import PatientLabReportPage from './pages/patient/PatientLabReportPage'
import AuroraAiPage from './pages/patient/AuroraAiPage'
import PatientVitalsPage from './pages/patient/PatientVitalsPage'
import PatientEmergencyPage from './pages/patient/PatientEmergencyPage'
import PatientMedicalCardPage from './pages/patient/PatientMedicalCardPage'
import DoctorLayout from './pages/doctor/DoctorLayout'
import DoctorOverviewPage from './pages/doctor/DoctorOverviewPage'
import DoctorAppointmentsPage from './pages/doctor/DoctorAppointmentsPage'
import DoctorTimetablePage from './pages/doctor/DoctorTimetablePage'
import DoctorLabPage from './pages/doctor/DoctorLabPage'
import DoctorAiPage from './pages/doctor/DoctorAiPage'
import DoctorWorkspacePage from './pages/doctor/DoctorWorkspacePage'
import DoctorSettingsPage from './pages/doctor/DoctorSettingsPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverviewPage from './pages/admin/AdminOverviewPage'
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage'
import AdminVerificationPage from './pages/admin/AdminVerificationPage'
import AdminHospitalsPage from './pages/admin/AdminHospitalsPage'
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage'
import AdminAiPage from './pages/admin/AdminAiPage'
import AdminPlatformPage from './pages/admin/AdminPlatformPage'
import AdminAccountsPage from './pages/admin/AdminAccountsPage'

function App() {
  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <GuestOnly>
                  <LandingPage />
                </GuestOnly>
              }
            />
            <Route
              path="/about"
              element={
                <GuestOnly>
                  <AboutPage />
                </GuestOnly>
              }
            />
            <Route
              path="/contact"
              element={
                <GuestOnly>
                  <ContactPage />
                </GuestOnly>
              }
            />
            <Route
              path="/features"
              element={
                <GuestOnly>
                  <FeaturesPage />
                </GuestOnly>
              }
            />
            <Route
              path="/how-it-works"
              element={
                <GuestOnly>
                  <HowItWorksPage />
                </GuestOnly>
              }
            />
            <Route
              path="/for-hospitals"
              element={
                <GuestOnly>
                  <ForHospitalsPage />
                </GuestOnly>
              }
            />
            <Route
              path="/signin"
              element={
                <GuestOnly>
                  <SignInPage />
                </GuestOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestOnly>
                  <SignUpPage />
                </GuestOnly>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <GuestOnly>
                  <ForgotPasswordPage />
                </GuestOnly>
              }
            />
            <Route
              path="/hospital/signin"
              element={
                <GuestOnly>
                  <HospitalSignInPage />
                </GuestOnly>
              }
            />
            <Route
              path="/hospital/apply"
              element={
                <GuestOnly>
                  <HospitalApplyPage />
                </GuestOnly>
              }
            />

            <Route
              path="/verify-email"
              element={
                <RequireRole>
                  <VerifyEmailPage />
                </RequireRole>
              }
            />

            <Route
              element={
                <RequireRole roles={['patient', 'admin']}>
                  <PatientLayout />
                </RequireRole>
              }
            >
              <Route path="/dashboard" element={<PatientOverviewPage />} />
              <Route path="/dashboard/settings" element={<PatientSettingsPage />} />
              <Route path="/dashboard/appointments" element={<PatientAppointmentsPage />} />
              <Route path="/dashboard/ai-doctors" element={<AuroraAiPage mode="doctors" />} />
              <Route path="/dashboard/therapy" element={<AuroraAiPage mode="therapy" />} />
              <Route path="/dashboard/lab" element={<PatientLabPage />} />
              <Route path="/dashboard/vitals" element={<PatientVitalsPage />} />
              <Route path="/dashboard/emergency" element={<PatientEmergencyPage />} />
              <Route path="/dashboard/medical-card" element={<PatientMedicalCardPage />} />
              <Route path="/dashboard/lab/:orderId" element={<PatientLabReportPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/explore/:hospitalId" element={<HospitalDetailPage />} />
            </Route>

            <Route path="/hospital/pending" element={<HospitalPendingPage />} />
            <Route
              path="/doctor"
              element={
                <RequireRole role="doctor">
                  <DoctorLayout />
                </RequireRole>
              }
            >
              <Route index element={<DoctorOverviewPage />} />
              <Route path="appointments" element={<DoctorAppointmentsPage />} />
              <Route path="timetable" element={<DoctorTimetablePage />} />
              <Route path="lab" element={<DoctorLabPage />} />
              <Route path="ai" element={<DoctorAiPage />} />
              <Route path="workspace" element={<DoctorWorkspacePage />} />
              <Route path="settings" element={<DoctorSettingsPage />} />
            </Route>
            <Route
              path="/hospital"
              element={
                <RequireRole role="hospital">
                  <HospitalLayout />
                </RequireRole>
              }
            >
              <Route index element={<HospitalOverviewPage />} />
              <Route path="profile" element={<HospitalProfilePage />} />
              <Route path="settings" element={<HospitalSettingsPage />} />
              <Route path="appointments" element={<HospitalAppointmentsPage />} />
              <Route path="doctors" element={<HospitalDoctorsPage />} />
              <Route path="lab" element={<HospitalLabPage />} />
              <Route path="inventory" element={<HospitalInventoryPage />} />
              <Route path="marketplace" element={<HospitalMarketplacePage />} />
              <Route path="public-page" element={<HospitalPublicPage />} />
              <Route path="verification" element={<HospitalVerificationPage />} />
              <Route path="fleet" element={<HospitalFleetPage />} />
              <Route path="operations" element={<HospitalOperationsPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="applications" element={<AdminApplicationsPage />} />
              <Route path="verification" element={<AdminVerificationPage />} />
              <Route path="hospitals" element={<AdminHospitalsPage />} />
              <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
              <Route path="ai" element={<AdminAiPage />} />
              <Route path="platform" element={<AdminPlatformPage />} />
              <Route path="accounts" element={<AdminAccountsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </MotionConfig>
    </BrowserRouter>
  )
}

export default App
