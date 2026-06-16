import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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
import Onboarding from '@/pages/Onboarding';
import Home from '@/pages/Home';
import AITrainer from '@/pages/AITrainer';
import Workout from '@/pages/Workout';
import WorkoutLog from '@/pages/WorkoutLog';
import ExerciseLibrary from '@/pages/ExerciseLibrary';
import Nutrition from '@/pages/Nutrition';
import NutritionLog from '@/pages/NutritionLog';
import Tracking from '@/pages/Tracking';
import WaterTracking from '@/pages/tracking/WaterTracking';
import StepTracking from '@/pages/tracking/StepTracking';
import SleepTracking from '@/pages/tracking/SleepTracking';
import WeightTracking from '@/pages/tracking/WeightTracking';
import BodyMeasurements from '@/pages/tracking/BodyMeasurements';
import CardioTracking from '@/pages/tracking/CardioTracking';
import HabitTracking from '@/pages/tracking/HabitTracking';
import MoodTracking from '@/pages/tracking/MoodTracking';
import GymAttendance from '@/pages/tracking/GymAttendance';
import Progress from '@/pages/Progress';
import Community from '@/pages/Community';
import Profile from '@/pages/Profile';
import Notifications from '@/pages/Notifications';
import Subscription from '@/pages/Subscription';

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
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Onboarding (protected but no shell) */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main app with shell */}
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/ai-trainer" element={<AITrainer />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/workout/log" element={<WorkoutLog />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/nutrition/log" element={<NutritionLog />} />
          <Route path="/tracking" element={<Tracking />} />
          <Route path="/tracking/water" element={<WaterTracking />} />
          <Route path="/tracking/steps" element={<StepTracking />} />
          <Route path="/tracking/sleep" element={<SleepTracking />} />
          <Route path="/tracking/weight" element={<WeightTracking />} />
          <Route path="/tracking/measurements" element={<BodyMeasurements />} />
          <Route path="/tracking/cardio" element={<CardioTracking />} />
          <Route path="/tracking/habits" element={<HabitTracking />} />
          <Route path="/tracking/mood" element={<MoodTracking />} />
          <Route path="/tracking/gym-attendance" element={<GymAttendance />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/community" element={<Community />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/subscription" element={<Subscription />} />
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