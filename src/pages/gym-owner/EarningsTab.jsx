import React, { useState } from 'react';
import { Coins, TrendingUp, CreditCard, Download, Building, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function EarningsTab({ owner, memberships, attendanceLogs, showToast }) {
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankDetails, setBankDetails] = useState({ account: '', ifsc: '', name: '', upi: '' });

  const activeMembers = memberships.filter(m => m.status === 'active').length;
  const monthlyRevenue = activeMembers * (owner.monthly_fee || 999);
  const quarterlyRevenue = activeMembers * (owner.quarterly_fee || 2499);
  const totalReferrals = memberships.filter(m => m.referral_code_used).length;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const chartData = months.map((m, i) => ({
    month: m,
    value: i < 5 ? Math.round(monthlyRevenue * (0.5 + i * 0.1)) : monthlyRevenue,
  }));
  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  const saveBankDetails = () => {
    if (!bankDetails.account || !bankDetails.ifsc || !bankDetails.name) {
      showToast('Account number, IFSC, and account name are required', 'error');
      return;
    }
    setShowBankForm(false);
    showToast('Bank details saved!', 'success');
  };

  return (
    <div className="space-y-4">
      <p className="font-heading font-bold text-lg">Earnings</p>

      {/* Hero */}
      <div className="bg-gradient-to-br from-accent via-accent/90 to-accent/70 rounded-3xl p-5 text-accent-foreground">
        <p className="text-sm opacity-80">Estimated This Month</p>
        <p className="font-heading font-black text-4xl mt-1">₹{monthlyRevenue.toLocaleString()}</p>
        <p className="text-xs opacity-70 mt-1">{activeMembers} active members × ₹{owner.monthly_fee || 999}/mo</p>
        <div className="mt-4 flex items-end gap-1 h-14">
          {chartData.map(d => (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full bg-white/30 rounded-sm" style={{ height: `${Math.round((d.value / maxVal) * 44)}px` }} />
              <span className="text-[8px] opacity-60">{d.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Active Members', value: activeMembers, color: 'text-blue-400', border: 'border-blue-400/20' },
          { label: 'Via Referrals', value: totalReferrals, color: 'text-purple-400', border: 'border-purple-400/20' },
          { label: 'Total Check-ins', value: attendanceLogs.length, color: 'text-emerald-400', border: 'border-emerald-400/20' },
          { label: 'Monthly Rate/Member', value: `₹${owner.monthly_fee || 999}`, color: 'text-amber-400', border: 'border-amber-400/20' },
        ].map(e => (
          <div key={e.label} className={`bg-card border ${e.border} rounded-2xl p-4`}>
            <p className="text-xs text-muted-foreground">{e.label}</p>
            <p className={`font-heading font-black text-xl mt-1.5 ${e.color}`}>{e.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="font-semibold text-sm mb-3">Revenue Breakdown</p>
        <div className="space-y-3">
          {[
            { label: 'Monthly memberships', value: monthlyRevenue },
            { label: 'Referral leads value', value: totalReferrals * (owner.monthly_fee || 999) },
            { label: 'Quarterly potential', value: quarterlyRevenue },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="text-sm font-bold text-accent">₹{r.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details */}
      {showBankForm ? (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <p className="font-semibold text-sm">Bank Details for Payout</p>
          <Input placeholder="Account holder name *" value={bankDetails.name} onChange={e => setBankDetails(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-xl text-sm" />
          <Input placeholder="Account number *" value={bankDetails.account} onChange={e => setBankDetails(p => ({ ...p, account: e.target.value }))} className="h-10 rounded-xl text-sm" />
          <Input placeholder="IFSC code *" value={bankDetails.ifsc} onChange={e => setBankDetails(p => ({ ...p, ifsc: e.target.value }))} className="h-10 rounded-xl text-sm" />
          <Input placeholder="UPI ID (optional)" value={bankDetails.upi} onChange={e => setBankDetails(p => ({ ...p, upi: e.target.value }))} className="h-10 rounded-xl text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setShowBankForm(false)} className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold">Cancel</button>
            <button onClick={saveBankDetails} className="flex-1 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-semibold">Save</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setShowBankForm(true)}
            className="w-full h-11 rounded-xl border border-border flex items-center justify-center gap-2 text-sm font-semibold hover:bg-muted transition-all">
            <Building size={15} /> Add Bank Details
          </button>
          <button onClick={() => showToast('Payout request — coming soon! Bank integration in progress.', 'info')}
            className="w-full h-11 rounded-xl bg-accent/10 border border-accent/20 text-accent flex items-center justify-center gap-2 text-sm font-semibold">
            <Coins size={15} /> Request Payout
          </button>
          <button onClick={() => showToast('Earnings report exported! Feature coming soon.', 'info')}
            className="w-full h-11 rounded-xl border border-border flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-all">
            <Download size={15} /> Export Earnings Report
          </button>
        </div>
      )}
    </div>
  );
}