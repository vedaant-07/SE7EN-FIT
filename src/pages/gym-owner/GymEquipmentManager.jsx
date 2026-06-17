import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, CheckCircle2, XCircle, Dumbbell, Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

const PRESET_EQUIPMENT = [
  { name: 'Dumbbells', category: 'free_weights', muscles: ['chest', 'shoulders', 'arms', 'back'] },
  { name: 'Barbells', category: 'free_weights', muscles: ['chest', 'back', 'legs', 'shoulders'] },
  { name: 'Bench Press', category: 'strength_machine', muscles: ['chest', 'shoulders', 'triceps'] },
  { name: 'Incline Bench', category: 'strength_machine', muscles: ['upper chest', 'shoulders'] },
  { name: 'Squat Rack', category: 'strength_machine', muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Smith Machine', category: 'strength_machine', muscles: ['quads', 'chest', 'shoulders'] },
  { name: 'Cable Crossover', category: 'cable', muscles: ['chest', 'shoulders', 'arms'] },
  { name: 'Lat Pulldown', category: 'cable', muscles: ['lats', 'biceps', 'back'] },
  { name: 'Seated Row Machine', category: 'cable', muscles: ['back', 'biceps'] },
  { name: 'Chest Press Machine', category: 'strength_machine', muscles: ['chest', 'triceps'] },
  { name: 'Shoulder Press Machine', category: 'strength_machine', muscles: ['shoulders', 'triceps'] },
  { name: 'Leg Press', category: 'strength_machine', muscles: ['quads', 'glutes', 'hamstrings'] },
  { name: 'Leg Extension', category: 'strength_machine', muscles: ['quads'] },
  { name: 'Leg Curl', category: 'strength_machine', muscles: ['hamstrings'] },
  { name: 'Calf Raise Machine', category: 'strength_machine', muscles: ['calves'] },
  { name: 'Treadmill', category: 'cardio', muscles: ['cardio', 'legs'] },
  { name: 'Cross Trainer', category: 'cardio', muscles: ['cardio', 'full body'] },
  { name: 'Cycling Machine', category: 'cardio', muscles: ['cardio', 'legs'] },
  { name: 'Rowing Machine', category: 'cardio', muscles: ['cardio', 'back', 'legs'] },
  { name: 'Pull-up Bar', category: 'bodyweight', muscles: ['lats', 'biceps', 'back'] },
  { name: 'Dip Station', category: 'bodyweight', muscles: ['chest', 'triceps', 'shoulders'] },
  { name: 'Kettlebells', category: 'free_weights', muscles: ['full body', 'core'] },
  { name: 'Resistance Bands', category: 'functional', muscles: ['full body'] },
  { name: 'Battle Rope', category: 'functional', muscles: ['cardio', 'shoulders', 'core'] },
  { name: 'Medicine Ball', category: 'functional', muscles: ['core', 'full body'] },
  { name: 'Pec Deck', category: 'strength_machine', muscles: ['chest', 'shoulders'] },
  { name: 'Hack Squat Machine', category: 'strength_machine', muscles: ['quads', 'glutes'] },
  { name: 'Functional Trainer', category: 'cable', muscles: ['full body'] },
];

const CATEGORIES = ['cardio', 'strength_machine', 'free_weights', 'cable', 'functional', 'bodyweight', 'other'];

export default function GymEquipmentManager({ gymId, ownerId }) {
  const { toast } = useToast();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('preset'); // 'preset' | 'custom'
  const [customForm, setCustomForm] = useState({ equipment_name: '', category: 'strength_machine', quantity: 1, notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (gymId) loadEquipment(); }, [gymId]);

  const loadEquipment = async () => {
    setLoading(true);
    const eq = await base44.entities.GymEquipment.filter({ gym_id: gymId });
    setEquipment(eq);
    setLoading(false);
  };

  const addPreset = async (preset) => {
    if (equipment.find(e => e.equipment_name === preset.name)) {
      toast({ title: 'Already added', description: `${preset.name} is already in your equipment list` });
      return;
    }
    setSaving(true);
    await base44.entities.GymEquipment.create({
      gym_id: gymId,
      owner_id: ownerId,
      equipment_name: preset.name,
      category: preset.category,
      target_muscles: preset.muscles,
      available: true,
      quantity: 1,
    });
    await loadEquipment();
    toast({ title: `✅ ${preset.name} added` });
    setSaving(false);
  };

  const addCustom = async () => {
    if (!customForm.equipment_name.trim()) return;
    setSaving(true);
    await base44.entities.GymEquipment.create({
      gym_id: gymId,
      owner_id: ownerId,
      ...customForm,
      available: true,
    });
    await loadEquipment();
    setCustomForm({ equipment_name: '', category: 'strength_machine', quantity: 1, notes: '' });
    setShowAdd(false);
    toast({ title: `✅ ${customForm.equipment_name} added` });
    setSaving(false);
  };

  const toggleAvailable = async (item) => {
    await base44.entities.GymEquipment.update(item.id, { available: !item.available });
    setEquipment(prev => prev.map(e => e.id === item.id ? { ...e, available: !e.available } : e));
  };

  const deleteItem = async (id) => {
    await base44.entities.GymEquipment.delete(id);
    setEquipment(prev => prev.filter(e => e.id !== id));
    toast({ title: 'Removed' });
  };

  const alreadyAdded = (name) => equipment.some(e => e.equipment_name === name);

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = equipment.filter(e => e.category === cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-bold text-base">Equipment & Tools</p>
          <p className="text-xs text-muted-foreground">{equipment.filter(e => e.available).length} available · {equipment.length} total</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="h-9 rounded-xl bg-accent text-accent-foreground text-xs font-semibold">
          <Plus size={14} className="mr-1" /> Add
        </Button>
      </div>

      {/* Add Panel */}
      {showAdd && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setAddMode('preset')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${addMode === 'preset' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
              From Presets
            </button>
            <button onClick={() => setAddMode('custom')}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${addMode === 'custom' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
              Custom
            </button>
          </div>

          {addMode === 'preset' && (
            <div>
              <p className="text-xs text-muted-foreground mb-3">Tap to add. Green = already added.</p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {PRESET_EQUIPMENT.map(p => {
                  const added = alreadyAdded(p.name);
                  return (
                    <button key={p.name} onClick={() => !added && addPreset(p)} disabled={saving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                        added ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-muted border-border text-muted-foreground hover:border-accent/30'
                      }`}>
                      {added && <Check size={10} />}
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {addMode === 'custom' && (
            <div className="space-y-3">
              <Input placeholder="Equipment name" value={customForm.equipment_name}
                onChange={e => setCustomForm(f => ({ ...f, equipment_name: e.target.value }))}
                className="h-10 rounded-xl text-sm" />
              <select value={customForm.category}
                onChange={e => setCustomForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-10 px-3 rounded-xl border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
              <Input type="number" placeholder="Quantity" value={customForm.quantity}
                onChange={e => setCustomForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="h-10 rounded-xl text-sm" />
              <Button onClick={addCustom} disabled={saving || !customForm.equipment_name.trim()}
                className="w-full h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">
                {saving ? 'Adding...' : 'Add Equipment'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Equipment List by Category */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : equipment.length === 0 ? (
        <div className="bg-muted/30 border border-border rounded-2xl p-8 text-center">
          <Dumbbell size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold">No equipment added yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add equipment to personalize member workouts</p>
        </div>
      ) : (
        CATEGORIES.map(cat => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-accent mb-3 capitalize">{cat.replace('_', ' ')}</p>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <button onClick={() => toggleAvailable(item)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${item.available ? 'bg-emerald-500/20' : 'bg-muted'}`}>
                      {item.available
                        ? <CheckCircle2 size={14} className="text-emerald-400" />
                        : <XCircle size={14} className="text-muted-foreground" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.available ? 'font-medium' : 'text-muted-foreground line-through'}`}>
                      {item.equipment_name}
                    </span>
                    {item.quantity > 1 && <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>}
                    <button onClick={() => deleteItem(item.id)}
                      className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}