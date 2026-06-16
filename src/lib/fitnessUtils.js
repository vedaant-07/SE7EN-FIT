// SE7ENFIT Fitness Calculation Utilities

export function calculateBMI(weightKg, heightCm) {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400' };
  if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-yellow-400' };
  return { label: 'Obese', color: 'text-red-400' };
}

export function calculateBMR(weightKg, heightCm, age, gender) {
  if (gender === 'male') {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  }
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
}

export function calculateTDEE(bmr, activityLevel) {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };
  return Math.round(bmr * (multipliers[activityLevel] || 1.55));
}

export function calculateCalorieTarget(tdee, goal) {
  const adjustments = {
    weight_loss: -500,
    fat_loss: -400,
    muscle_gain: 300,
    strength_gain: 200,
    body_transformation: -300,
    general_fitness: 0,
    maintenance: 0
  };
  return Math.round(tdee + (adjustments[goal] || 0));
}

export function calculateProteinTarget(weightKg, goal) {
  const multipliers = {
    weight_loss: 1.6,
    fat_loss: 1.8,
    muscle_gain: 2.0,
    strength_gain: 1.8,
    body_transformation: 1.8,
    general_fitness: 1.4,
    maintenance: 1.2
  };
  return Math.round(weightKg * (multipliers[goal] || 1.4));
}

export function calculateWaterGoal(weightKg) {
  return Math.round(weightKg * 35);
}

export function getActivityLevel(workoutDays) {
  if (workoutDays <= 1) return 'sedentary';
  if (workoutDays <= 2) return 'light';
  if (workoutDays <= 4) return 'moderate';
  if (workoutDays <= 5) return 'active';
  return 'very_active';
}

export function calculateFitnessScore(data) {
  let score = 0;
  if (data.workoutDone) score += 25;
  if (data.stepsPercent >= 100) score += 20;
  else score += Math.round(data.stepsPercent * 0.2);
  if (data.waterPercent >= 100) score += 15;
  else score += Math.round(data.waterPercent * 0.15);
  if (data.caloriesOnTrack) score += 20;
  if (data.sleepHours >= 7) score += 10;
  if (data.proteinOnTrack) score += 10;
  return Math.min(score, 100);
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function getToday() {
  return new Date().toISOString().split('T')[0];
}

export const GOALS_LABELS = {
  weight_loss: 'Weight Loss',
  muscle_gain: 'Muscle Gain',
  fat_loss: 'Fat Loss',
  strength_gain: 'Strength Gain',
  general_fitness: 'General Fitness',
  body_transformation: 'Body Transformation',
  maintenance: 'Maintenance'
};

export const MEAL_TYPES = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'snack', label: 'Snack', icon: '🍎' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'pre_workout', label: 'Pre-Workout', icon: '⚡' },
  { key: 'post_workout', label: 'Post-Workout', icon: '💪' },
  { key: 'supplements', label: 'Supplements', icon: '💊' }
];

export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'legs', 'glutes', 'abs', 'forearms', 'calves', 'full_body', 'cardio'
];