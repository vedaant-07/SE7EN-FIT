import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter, HashRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import AppShell from '@/components/se7enfit/AppShell';
import Welcome from '@/pages/Welcome';
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import AITrainer from '@/pages/AITrainer';
import Workout from '@/pages/Workout';
import WorkoutLog from '@/pages/WorkoutLog';
import WorkoutGuide from '@/pages/WorkoutGuide';
import ExerciseLibrary from '@/pages/ExerciseLibrary';
import Nutrition from '@/pages/Nutrition';
import NutritionLog from '@/pages/NutritionLog';
import Tracking from '@/pages/Tracking';
import Progress from '@/pages/Progress';
import Community from '@/pages/Community';
import Profile from '@/pages/Profile';
import Notifications from '@/pages/Notifications';
import Subscription from '@/pages/Subscription';
import FoodScan from '@/pages/FoodScan';
import Challenges from '@/pages/Challenges';
import Rewards from '@/pages/Rewards';
import PolicyPages from '@/pages/PolicyPages';
import GymOwnerLogin from '@/pages/GymOwnerLogin';
import GymOwnerRegister from '@/pages/GymOwnerRegister';
import UserLogin from '@/pages/UserLogin';
import UserSignup from '@/pages/UserSignup';
import GymOwnerLoginNew from '@/pages/GymOwnerLoginNew';
import GymOwnerSignup from '@/pages/GymOwnerSignup';
import GymOwnerOnboarding from '@/pages/GymOwnerOnboarding';
import GymOwnerDashboard from '@/pages/GymOwnerDashboard';
import MyGym from '@/pages/MyGym';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import Support from '@/pages/Support';

const isCapacitorBuild = import.meta.env.MODE === 'capacitor';
const isCapacitorWebView = typeof window !== 'undefined' && window.location.protocol === 'https:' && window.location.hostname === 'localhost';
const Router = isCapacitorBuild || isCapacitorWebView || Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="font-display font-bold text-2xl mb-4">SE<span className="text-accent">7</span>ENFIT</div>
          <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    else if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/login/user" element={<UserLogin />} />
      <Route path="/signup/user" element={<UserSignup />} />
      <Route path="/login/gym-owner" element={<GymOwnerLoginNew />} />
      <Route path="/signup/gym-owner" element={<GymOwnerSignup />} />
      <Route path="/gym-owner/login" element={<GymOwnerLoginNew />} />
      <Route path="/gym-owner/register" element={<GymOwnerSignup />} />
      <Route path="/terms" element={<PolicyPages />} />
      <Route path="/privacy" element={<PolicyPages />} />
      <Route path="/policy" element={<PolicyPages />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/welcome" replace />} />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/gym-owner/onboarding" element={<GymOwnerOnboarding />} />
        <Route path="/gym-owner/dashboard" element={<GymOwnerDashboard />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/user-dashboard" element={<Home />} />
          <Route path="/ai-trainer" element={<AITrainer />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/workout/log" element={<WorkoutLog />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/nutrition/log" element={<NutritionLog />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/tracking/water" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/steps" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/sleep" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/weight" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/measurements" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/cardio" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/habits" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/mood" element={<Navigate to="/tracking" replace />} />
          <Route path="/tracking/gym-attendance" element={<Navigate to="/tracking" replace />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/community" element={<Community />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/food-scan" element={<FoodScan />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/workout/guide" element={<WorkoutGuide />} />
          <Route path="/my-gym" element={<MyGym />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/support" element={<Support />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
