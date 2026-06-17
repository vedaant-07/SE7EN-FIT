// SE7ENFIT Gemini AI Service — Central backend service for all AI features
// SECURITY: API key is NEVER sent to frontend. All calls are server-side only.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── Model Constants ───────────────────────────────────────────────────────────
const GEMINI_TEXT_MODEL = 'gemini-2.0-flash';
const GEMINI_VISION_MODEL = 'gemini-2.0-flash';
const GEMINI_JSON_MODEL = 'gemini-2.0-flash';
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Subscription Plan Limits ──────────────────────────────────────────────────
const PLAN_LIMITS = {
  free: { ai_trainer: 3, food_scan: 0, workout_generation: 0, meal_plan: 0, progress_report: 0, daily_tip: 1, exercise_alternative: 0 },
  free_trial: { ai_trainer: 5, food_scan: 3, workout_generation: 2, meal_plan: 1, progress_report: 1, daily_tip: 3, exercise_alternative: 3 },
  basic_monthly: { ai_trainer: 20, food_scan: 10, workout_generation: 5, meal_plan: 3, progress_report: 2, daily_tip: 10, exercise_alternative: 10 },
  premium_monthly: { ai_trainer: -1, food_scan: -1, workout_generation: -1, meal_plan: -1, progress_report: -1, daily_tip: -1, exercise_alternative: -1 },
  premium_quarterly: { ai_trainer: -1, food_scan: -1, workout_generation: -1, meal_plan: -1, progress_report: -1, daily_tip: -1, exercise_alternative: -1 },
  premium_annual: { ai_trainer: -1, food_scan: -1, workout_generation: -1, meal_plan: -1, progress_report: -1, daily_tip: -1, exercise_alternative: -1 },
};

// ─── Core Helpers ──────────────────────────────────────────────────────────────

function getGeminiApiKey() {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY not configured');
  return key;
}

async function callGeminiText(prompt, options = {}) {
  const key = getGeminiApiKey();
  const model = options.model || GEMINI_TEXT_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.maxTokens ?? 2048 },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiJson(prompt, options = {}) {
  const key = getGeminiApiKey();
  const model = options.model || GEMINI_JSON_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;
  const jsonPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown code blocks. No explanations outside JSON.`;
  const body = {
    contents: [{ parts: [{ text: jsonPrompt }] }],
    generationConfig: { temperature: options.temperature ?? 0.3, maxOutputTokens: options.maxTokens ?? 4096, responseMimeType: 'application/json' },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return parseGeminiJsonResponse(text);
}

async function callGeminiWithImage(prompt, base64Image, mimeType = 'image/jpeg', options = {}) {
  const key = getGeminiApiKey();
  const model = options.model || GEMINI_VISION_MODEL;
  const url = `${GEMINI_API_BASE}/${model}:generateContent?key=${key}`;
  const jsonPrompt = `${prompt}\n\nReturn ONLY valid JSON. No markdown. No explanations.`;
  const body = {
    contents: [{ parts: [{ text: jsonPrompt }, { inlineData: { mimeType, data: base64Image } }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: 'application/json' },
  };
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Gemini Vision error ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return parseGeminiJsonResponse(text);
}

function parseGeminiJsonResponse(text) {
  try {
    // Strip markdown code blocks if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Try extracting JSON from text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

function handleGeminiError(error, feature) {
  const msg = error?.message || '';
  if (msg.includes('GEMINI_API_KEY')) return { error: 'AI service not configured. Please contact support.' };
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) return { error: 'AI is busy right now. Please try again in a moment.' };
  if (msg.includes('quota')) return { error: 'AI daily quota reached. Try again tomorrow.' };
  return { error: `AI Trainer is temporarily unavailable. Please try again. (${feature})` };
}

// ─── Usage Limit Checker ───────────────────────────────────────────────────────

async function validateAiUsageLimit(base44, userId, feature, plan) {
  const limit = PLAN_LIMITS[plan]?.[feature] ?? 0;
  if (limit === -1) return { allowed: true }; // unlimited
  if (limit === 0) return { allowed: false, reason: 'Upgrade to unlock this AI feature.', locked: true, feature };

  try {
    const today = new Date().toISOString().slice(0, 10);
    const logs = await base44.asServiceRole.entities.AIUsageLog.filter({ user_id: userId, feature, date: today });
    const usageToday = logs.filter(l => l.success).length;
    if (usageToday >= limit) return { allowed: false, reason: `Daily limit of ${limit} reached for ${feature}. Upgrade to continue.`, locked: true, feature };
    return { allowed: true, remaining: limit - usageToday };
  } catch {
    return { allowed: true }; // allow if entity not ready yet
  }
}

async function logAiUsage(base44, userId, feature, success, errorMessage = null) {
  try {
    await base44.asServiceRole.entities.AIUsageLog.create({
      user_id: userId, feature, success: success === true, date: new Date().toISOString().slice(0, 10),
      error_message: errorMessage ? errorMessage.slice(0, 200) : null,
    });
  } catch { /* non-critical */ }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, ...params } = body;

    // Get user subscription
    const subs = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id, status: 'active' });
    const plan = subs[0]?.plan || 'free';

    // ── AI TRAINER ────────────────────────────────────────────────────────────
    if (action === 'askAiTrainer') {
      const { message, context } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'ai_trainer', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'ai_trainer', message: check.reason });

      const systemPrompt = `You are SE7ENFIT AI Trainer, an expert Indian fitness coach inside a fitness app.

USER PROFILE:
${JSON.stringify(context?.profile || {}, null, 2)}

TRACKING TODAY:
${JSON.stringify(context?.tracking || {}, null, 2)}

GYM INFO:
${JSON.stringify(context?.gym || {}, null, 2)}

AVAILABLE GYM EQUIPMENT: ${context?.equipment?.map(e => e.equipment_name).join(', ') || 'Not specified'}

RULES:
- Give safe, practical, personalized advice based on the user's profile above.
- Prefer Indian food examples (roti, dal, rice, paneer, chicken, curd, eggs).
- If gym equipment is listed, ONLY suggest exercises using that equipment.
- If no gym equipment, suggest bodyweight/home exercises.
- Never recommend steroids, SARMs, or dangerous substances.
- Never give medical diagnosis. For injuries/disease, recommend consulting a doctor.
- Keep answers clear, motivational, action-focused. Use markdown formatting.
- Always address user by name if available.`;

      const fullPrompt = `${systemPrompt}\n\nUser asks: ${message}`;
      
      let reply, success = true, errMsg = null;
      try {
        reply = await callGeminiText(fullPrompt, { maxTokens: 1024 });
      } catch (e) {
        success = false;
        errMsg = e.message;
        const fallback = handleGeminiError(e, 'ai_trainer');
        await logAiUsage(base44, user.id, 'ai_trainer', false, errMsg);
        return Response.json(fallback);
      }

      await logAiUsage(base44, user.id, 'ai_trainer', true);
      // Save chat
      await base44.asServiceRole.entities.AIChat.create({ user_id: user.id, role: 'user', message, created_date: new Date().toISOString() });
      await base44.asServiceRole.entities.AIChat.create({ user_id: user.id, role: 'assistant', message: reply, created_date: new Date().toISOString() });

      return Response.json({ reply });
    }

    // ── FOOD SCAN ─────────────────────────────────────────────────────────────
    if (action === 'analyzeFoodImage') {
      const { imageBase64, mimeType, mealType } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'food_scan', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'food_scan', message: check.reason });
      if (!imageBase64) return Response.json({ error: 'No image provided' }, { status: 400 });

      const prompt = `You are SE7ENFIT AI Food Scanner. Analyze this food image and estimate nutrition for an Indian fitness app user.

Return ONLY valid JSON with this exact structure:
{
  "detectedFoods": [
    {
      "name": "string",
      "estimatedCalories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "fiber": 0,
      "servingSize": "string",
      "confidence": 0
    }
  ],
  "totalCalories": 0,
  "totalProtein": 0,
  "totalCarbs": 0,
  "totalFat": 0,
  "totalFiber": 0,
  "overallConfidence": 0,
  "notes": "Nutrition values are estimates. Verify quantity manually."
}

RULES:
- Detect Indian foods when possible (roti, rice, dal, sabzi, paneer, chicken, egg, etc.)
- Estimate based on visible quantity
- If quantity unclear, use lower confidence (below 70)
- If image is not food, return empty detectedFoods array with low confidence
- Include calories, protein, carbs, fat, fiber for every item
- All numeric values must be numbers, not strings`;

      let result, success = true;
      try {
        result = await callGeminiWithImage(prompt, imageBase64, mimeType || 'image/jpeg');
      } catch (e) {
        success = false;
        await logAiUsage(base44, user.id, 'food_scan', false, e.message);
        return Response.json(handleGeminiError(e, 'food_scan'));
      }

      if (!result || !result.detectedFoods) {
        await logAiUsage(base44, user.id, 'food_scan', false, 'Invalid JSON response');
        return Response.json({ error: 'Could not analyze image. Upload a clearer food photo.' });
      }

      await logAiUsage(base44, user.id, 'food_scan', true);
      return Response.json(result);
    }

    // ── WORKOUT GENERATOR ─────────────────────────────────────────────────────
    if (action === 'generateWorkout') {
      const { profile, equipment, gymName } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'workout_generation', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'workout_generation', message: check.reason });

      const equipList = equipment?.length > 0 ? equipment.map(e => e.equipment_name).join(', ') : 'bodyweight only';
      const prompt = `You are SE7ENFIT AI Workout Generator. Create a personalized workout plan.

USER PROFILE: ${JSON.stringify(profile, null, 2)}
CONNECTED GYM: ${gymName || 'None'}
AVAILABLE EQUIPMENT: ${equipList}

Return ONLY valid JSON:
{
  "planName": "string",
  "goal": "string",
  "connectedGymName": "${gymName || ''}",
  "generatedFromGymEquipment": ${equipment?.length > 0},
  "weeklySchedule": [
    {
      "day": "Monday",
      "focus": "Push",
      "estimatedDurationMinutes": 60,
      "exercises": [
        {
          "exerciseName": "string",
          "targetMuscle": "string",
          "secondaryMuscles": ["string"],
          "equipmentUsed": "string",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "difficulty": "Beginner",
          "instructions": ["step 1", "step 2"],
          "breathingGuide": "string",
          "commonMistakes": ["mistake"],
          "formTips": ["tip"],
          "animationType": "css"
        }
      ]
    }
  ],
  "notes": "string",
  "safetyNote": "string"
}

RULES:
- Only use equipment from the AVAILABLE EQUIPMENT list above
- If no gym equipment, use bodyweight exercises only
- Match difficulty to user's fitness level: ${profile?.fitness_level || 'beginner'}
- Create ${profile?.workout_days_per_week || 3} workout days
- Include proper warm-up notes in safetyNote
- If injuries listed, avoid exercises that stress those areas`;

      let result, success = true;
      try {
        result = await callGeminiJson(prompt, { maxTokens: 4096 });
      } catch (e) {
        success = false;
        await logAiUsage(base44, user.id, 'workout_generation', false, e.message);
        return Response.json(handleGeminiError(e, 'workout_generation'));
      }

      if (!result?.weeklySchedule) {
        await logAiUsage(base44, user.id, 'workout_generation', false, 'Invalid JSON');
        return Response.json({ error: 'AI could not generate workout. Please try again.' });
      }

      await logAiUsage(base44, user.id, 'workout_generation', true);
      return Response.json(result);
    }

    // ── EXERCISE ALTERNATIVE ──────────────────────────────────────────────────
    if (action === 'exerciseAlternative') {
      const { exerciseName, reason, profile, equipment } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'exercise_alternative', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'exercise_alternative', message: check.reason });

      const equipList = equipment?.length > 0 ? equipment.map(e => e.equipment_name).join(', ') : 'bodyweight';
      const prompt = `Suggest a safe alternative exercise for an Indian fitness app user.
Original exercise: ${exerciseName}
Reason for alternative: ${reason || 'user request'}
User goal: ${profile?.goal || 'general fitness'}
User injuries: ${profile?.injuries || profile?.medical_notes || 'none'}
Available equipment: ${equipList}

Return JSON:
{
  "originalExercise": "${exerciseName}",
  "alternativeExercise": "string",
  "reason": "string",
  "equipmentUsed": "string",
  "sets": 3,
  "reps": "10-12",
  "restSeconds": 60,
  "instructions": ["step 1"],
  "safetyNote": "string"
}`;

      let result;
      try {
        result = await callGeminiJson(prompt);
        await logAiUsage(base44, user.id, 'exercise_alternative', true);
      } catch (e) {
        await logAiUsage(base44, user.id, 'exercise_alternative', false, e.message);
        return Response.json(handleGeminiError(e, 'exercise_alternative'));
      }
      return Response.json(result);
    }

    // ── MEAL PLAN ─────────────────────────────────────────────────────────────
    if (action === 'generateMealPlan') {
      const { profile } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'meal_plan', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'meal_plan', message: check.reason });

      const prompt = `Create a personalized 1-day Indian meal plan for a fitness app user.
User: Age ${profile?.age}, Gender ${profile?.gender}, Weight ${profile?.weight_kg}kg, Height ${profile?.height_cm}cm
Goal: ${profile?.goal}, Diet: ${profile?.diet_preference?.replace(/_/g, ' ')}, Level: ${profile?.fitness_level}

Return JSON:
{
  "dailyCaloriesTarget": 0,
  "dailyProteinTarget": 0,
  "meals": [
    {
      "mealType": "Breakfast",
      "mealName": "string",
      "foods": ["food item"],
      "calories": 0,
      "protein": 0,
      "carbs": 0,
      "fat": 0,
      "fiber": 0,
      "notes": "string"
    }
  ],
  "shoppingList": ["item"],
  "tips": ["tip"]
}

RULES:
- Use Indian foods (roti, rice, dal, paneer, curd, eggs, chicken, fruits)
- Match diet preference: ${profile?.diet_preference}
- Include Breakfast, Mid-morning, Lunch, Evening snack, Dinner, Post-workout
- All foods budget-friendly and easily available in India`;

      let result;
      try {
        result = await callGeminiJson(prompt, { maxTokens: 3000 });
        await logAiUsage(base44, user.id, 'meal_plan', true);
      } catch (e) {
        await logAiUsage(base44, user.id, 'meal_plan', false, e.message);
        return Response.json(handleGeminiError(e, 'meal_plan'));
      }
      return Response.json(result);
    }

    // ── PROGRESS REPORT ───────────────────────────────────────────────────────
    if (action === 'generateProgressReport') {
      const { logs, period } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'progress_report', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'progress_report', message: check.reason });

      const prompt = `Analyze this fitness data and generate a ${period || 'weekly'} progress report for an Indian fitness app user.

DATA: ${JSON.stringify(logs, null, 2)}

Return JSON:
{
  "summary": "string",
  "workoutAnalysis": "string",
  "nutritionAnalysis": "string",
  "stepsAnalysis": "string",
  "waterAnalysis": "string",
  "sleepAnalysis": "string",
  "weightAnalysis": "string",
  "gymAttendanceAnalysis": "string",
  "challengeAnalysis": "string",
  "topWins": ["win"],
  "problems": ["problem"],
  "nextWeekFocus": ["focus area"],
  "recommendedChanges": ["change"],
  "safetyNote": "string"
}

Be specific, positive, and actionable. Use Indian context where relevant.`;

      let result;
      try {
        result = await callGeminiJson(prompt, { maxTokens: 3000 });
        await logAiUsage(base44, user.id, 'progress_report', true);
      } catch (e) {
        await logAiUsage(base44, user.id, 'progress_report', false, e.message);
        return Response.json(handleGeminiError(e, 'progress_report'));
      }
      return Response.json(result);
    }

    // ── DAILY TIP ─────────────────────────────────────────────────────────────
    if (action === 'getDailyTip') {
      const { profile, recentActivity } = params;
      const check = await validateAiUsageLimit(base44, user.id, 'daily_tip', plan);
      if (!check.allowed) return Response.json({ locked: true, feature: 'daily_tip', message: check.reason });

      const prompt = `Generate a personalized daily fitness tip for an Indian fitness app user.
Goal: ${profile?.goal}, Level: ${profile?.fitness_level}, Diet: ${profile?.diet_preference}
Recent activity: ${JSON.stringify(recentActivity || {})}

Return JSON:
{
  "tipTitle": "string (5 words max)",
  "tip": "string (2-3 sentences, practical and actionable)",
  "action": "string (one specific action to take today)",
  "category": "workout"
}
category must be one of: workout, nutrition, steps, water, sleep, motivation`;

      let result;
      try {
        result = await callGeminiJson(prompt);
        await logAiUsage(base44, user.id, 'daily_tip', true);
        // Save tip
        await base44.asServiceRole.entities.AIRecommendation.create({
          user_id: user.id, type: 'daily_tip', content: JSON.stringify(result), date: new Date().toISOString().slice(0, 10),
        });
      } catch (e) {
        await logAiUsage(base44, user.id, 'daily_tip', false, e.message);
        return Response.json(handleGeminiError(e, 'daily_tip'));
      }
      return Response.json(result);
    }

    // ── FITNESS SCORE INSIGHT ─────────────────────────────────────────────────
    if (action === 'fitnessScoreInsight') {
      const { score, profile, recentLogs } = params;
      const prompt = `Give a fitness score insight for an Indian fitness app user.
Current score: ${score}/100
Profile: ${JSON.stringify(profile || {})}
Recent logs summary: ${JSON.stringify(recentLogs || {})}

Return JSON:
{
  "scoreSummary": "string",
  "mainReason": "string",
  "todayActionPlan": ["action 1", "action 2", "action 3"],
  "motivation": "string (motivational 1-liner)"
}`;

      let result;
      try {
        result = await callGeminiJson(prompt);
      } catch (e) {
        return Response.json(handleGeminiError(e, 'fitness_score_insight'));
      }
      return Response.json(result);
    }

    // ── TRANSFORMATION INSIGHT ────────────────────────────────────────────────
    if (action === 'transformationInsight') {
      const { data } = params;
      const prompt = `Generate a transformation insight for an Indian fitness app user.
Data: ${JSON.stringify(data || {})}

Return JSON:
{
  "summary": "string",
  "positiveTrends": ["trend"],
  "needsImprovement": ["area"],
  "next30DaysPlan": ["action"],
  "safetyNote": "string"
}`;

      let result;
      try {
        result = await callGeminiJson(prompt);
      } catch (e) {
        return Response.json(handleGeminiError(e, 'transformation_insight'));
      }
      return Response.json(result);
    }

    // ── CHALLENGE RECOMMENDATION ──────────────────────────────────────────────
    if (action === 'recommendChallenges') {
      const { profile, stats } = params;
      const prompt = `Recommend fitness challenges for an Indian fitness app user.
Goal: ${profile?.goal}, Level: ${profile?.fitness_level}
Stats: ${JSON.stringify(stats || {})}

Return JSON:
{
  "recommendedChallenges": [
    {
      "challengeName": "string",
      "reason": "string",
      "difficulty": "Easy/Medium/Hard",
      "durationDays": 7,
      "expectedBenefit": "string"
    }
  ]
}
Recommend 3-5 challenges. Make them achievable for the user's level.`;

      let result;
      try {
        result = await callGeminiJson(prompt);
      } catch (e) {
        return Response.json(handleGeminiError(e, 'challenge_recommendation'));
      }
      return Response.json(result);
    }

    // ── TEST CONNECTION ───────────────────────────────────────────────────────
    if (action === 'testConnection') {
      const key = Deno.env.get('GEMINI_API_KEY');
      if (!key) return Response.json({ success: false, error: 'GEMINI_API_KEY missing' });
      return Response.json({ success: true, message: 'SE7ENFIT Gemini connected' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});