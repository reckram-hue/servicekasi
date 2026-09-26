import React, { useState } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Star,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import { Job, User } from '../types';
import { formatZAR } from '../lib/southAfrica';

interface TopTechnicianLeaderboardProps {
  jobs: Job[];
  technicians: User[];
  onSelectTechnician?: (techId: string) => void;
}

interface TechPerformance {
  tech: User;
  jobsCompleted: number;
  avgMarginPercent: number;
  totalGrossProfitZAR: number;
  avgRating: number;
  totalReviews: number;
  onTimeRate: number;
  recentTestimonial: string;
  badge: string;
  badgeDescription: string;
}

// Baseline historical operational performance for the current monthly cycle
const BASELINE_DATA: Record<
  string,
  {
    baseCompleted: number;
    baseMargin: number;
    baseProfitZAR: number;
    rating: number;
    reviews: number;
    onTimeRate: number;
    testimonial: string;
    badge: string;
    badgeDescription: string;
  }
> = {
  'user-tech-1': {
    baseCompleted: 14,
    baseMargin: 38.5,
    baseProfitZAR: 42800,
    rating: 4.92,
    reviews: 28,
    onTimeRate: 93,
    testimonial:
      '"Sipho did an immaculate 8kW solar inverter install in Fourways. DB board was wired with military precision!"',
    badge: 'Solar Master',
    badgeDescription: 'Highest total ZAR profit generated',
  },
  'user-tech-2': {
    baseCompleted: 19,
    baseMargin: 29.8,
    baseProfitZAR: 24600,
    rating: 4.81,
    reviews: 34,
    onTimeRate: 85,
    testimonial:
      '"Thabo worked late into the evening to fix our burst ceiling geyser in Soweto. True dedication."',
    badge: 'Iron Workhorse',
    badgeDescription: 'Most completed work orders',
  },
  'user-tech-3': {
    baseCompleted: 11,
    baseMargin: 56.4,
    baseProfitZAR: 36200,
    rating: 4.96,
    reviews: 22,
    onTimeRate: 98,
    testimonial:
      '"Pieter kept strict sterile dispensary protocols and fixed our vaccine cold storage unit with zero downtime."',
    badge: 'Efficiency Champion',
    badgeDescription: 'Best gross profit margin (56.4%)',
  },
  'user-tech-4': {
    baseCompleted: 10,
    baseMargin: 46.2,
    baseProfitZAR: 19400,
    rating: 4.94,
    reviews: 18,
    onTimeRate: 100,
    testimonial:
      '"Naledi arrived exactly on the minute in Bryanston and calibrated our Centurion D5 gate motor in under 45 minutes."',
    badge: 'Punctuality Ace',
    badgeDescription: '100% on-time schedule record',
  },
};

export const TopTechnicianLeaderboard: React.FC<TopTechnicianLeaderboardProps> = ({
  jobs,
  technicians,
  onSelectTechnician,
}) => {
  const [activeMetricTab, setActiveMetricTab] = useState<
    'ALL' | 'COMPLETED' | 'MARGIN' | 'RATING'
  >('ALL');

  // Compute live dynamic stats combined with baseline
  const performanceList: TechPerformance[] = technicians.map((tech) => {
    const base = BASELINE_DATA[tech.id] || {
      baseCompleted: 5,
      baseMargin: 35,
      baseProfitZAR: 15000,
      rating: 4.8,
      reviews: 10,
      onTimeRate: 90,
      testimonial: 'Excellent and professional field service.',
      badge: 'Certified Tech',
      badgeDescription: 'Quality field execution',
    };

    // Live jobs for this technician
    const techJobs = jobs.filter((j) => j.assignedTechId === tech.id);
    const liveCompleted = techJobs.filter(
      (j) => j.status === 'COMPLETED' || j.status === 'INVOICED'
    ).length;

    const liveProfits = techJobs.reduce(
      (sum, j) => sum + (j.costing?.actualProfitZAR || 0),
      0
    );

    const jobsWithMargin = techJobs.filter((j) => (j.costing?.actualMarginPercent || 0) > 0);
    const liveAvgMargin =
      jobsWithMargin.length > 0
        ? jobsWithMargin.reduce((sum, j) => sum + j.costing.actualMarginPercent, 0) /
          jobsWithMargin.length
        : base.baseMargin;

    const totalCompleted = base.baseCompleted + liveCompleted;
    const totalProfit = base.baseProfitZAR + liveProfits;
    const finalMargin = Math.round(((base.baseMargin + liveAvgMargin) / 2) * 10) / 10;

    return {
      tech,
      jobsCompleted: totalCompleted,
      avgMarginPercent: finalMargin,
      totalGrossProfitZAR: totalProfit,
      avgRating: base.rating,
      totalReviews: base.reviews + liveCompleted,
      onTimeRate: base.onTimeRate,
      recentTestimonial: base.testimonial,
      badge: base.badge,
      badgeDescription: base.badgeDescription,
    };
  });

  // Calculate Winners per category
  const mostJobsWinner = [...performanceList].sort(
    (a, b) => b.jobsCompleted - a.jobsCompleted
  )[0];

  const bestMarginWinner = [...performanceList].sort(
    (a, b) => b.avgMarginPercent - a.avgMarginPercent
  )[0];

  const highestRatingWinner = [...performanceList].sort(
    (a, b) => b.avgRating - a.avgRating
  )[0];

  // Sorting based on active tab
  const sortedTechnicians = [...performanceList].sort((a, b) => {
    if (activeMetricTab === 'COMPLETED') return b.jobsCompleted - a.jobsCompleted;
    if (activeMetricTab === 'MARGIN') return b.avgMarginPercent - a.avgMarginPercent;
    if (activeMetricTab === 'RATING') return b.avgRating - a.avgRating;
    return b.avgRating * b.avgMarginPercent - a.avgRating * a.avgMarginPercent;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs space-y-6 p-6">
      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Top Technician Leaderboard & Performance Awards
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-world Gauteng field recognition: Job volume, commercial profit margin & verified customer ratings
          </p>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveMetricTab('ALL')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeMetricTab === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Awards
          </button>
          <button
            onClick={() => setActiveMetricTab('COMPLETED')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeMetricTab === 'COMPLETED'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Most Jobs
          </button>
          <button
            onClick={() => setActiveMetricTab('MARGIN')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeMetricTab === 'MARGIN'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Best Margin
          </button>
          <button
            onClick={() => setActiveMetricTab('RATING')}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              activeMetricTab === 'RATING'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Top Rating
          </button>
        </div>
      </div>

      {/* 3 Gamified Category Winner Cards (Podium) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Most Jobs Completed */}
        <div className="bg-gradient-to-br from-amber-500/10 via-amber-50/40 to-white rounded-xl border border-amber-200/80 p-4 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider">
              <Flame className="w-4 h-4 text-amber-600" />
              <span>Most Jobs Completed</span>
            </div>
            <span className="text-[10px] font-bold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full uppercase">
              Workhorse
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={mostJobsWinner.tech.avatarUrl}
                alt={mostJobsWinner.tech.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 text-slate-950 rounded-full font-extrabold text-[10px] flex items-center justify-center border border-white">
                #1
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                {mostJobsWinner.tech.name}
              </h4>
              <p className="text-[11px] text-slate-500">{mostJobsWinner.tech.specialties[0]}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Completed Output:</span>
            <span className="font-mono font-extrabold text-amber-900 text-sm">
              {mostJobsWinner.jobsCompleted} Work Orders
            </span>
          </div>
        </div>

        {/* 2. Best P&L Margin */}
        <div className="bg-gradient-to-br from-emerald-500/10 via-emerald-50/40 to-white rounded-xl border border-emerald-200/80 p-4 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Best P&L Margin</span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full uppercase">
              Profit Champ
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={bestMarginWinner.tech.avatarUrl}
                alt={bestMarginWinner.tech.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-600 text-white rounded-full font-extrabold text-[10px] flex items-center justify-center border border-white">
                #1
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                {bestMarginWinner.tech.name}
              </h4>
              <p className="text-[11px] text-slate-500">{bestMarginWinner.tech.specialties[0]}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Realized Margin:</span>
            <div className="text-right font-mono">
              <span className="font-extrabold text-emerald-800 text-sm">
                {bestMarginWinner.avgMarginPercent}%
              </span>
              <span className="text-[10px] text-slate-400 block">
                ({formatZAR(bestMarginWinner.totalGrossProfitZAR)} profit)
              </span>
            </div>
          </div>
        </div>

        {/* 3. Highest Customer Rating */}
        <div className="bg-gradient-to-br from-blue-500/10 via-blue-50/40 to-white rounded-xl border border-blue-200/80 p-4 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 uppercase tracking-wider">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Highest Rating</span>
            </div>
            <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">
              Service Star
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={highestRatingWinner.tech.avatarUrl}
                alt={highestRatingWinner.tech.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-400 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 text-white rounded-full font-extrabold text-[10px] flex items-center justify-center border border-white">
                #1
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                {highestRatingWinner.tech.name}
              </h4>
              <p className="text-[11px] text-slate-500">{highestRatingWinner.tech.specialties[0]}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-blue-200/60 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Customer Rating:</span>
            <div className="flex items-center gap-1.5 font-mono">
              <div className="flex text-amber-400">
                {'★★★★★'.split('').map((star, i) => (
                  <span key={i} className="text-xs">
                    ★
                  </span>
                ))}
              </div>
              <span className="font-extrabold text-slate-900 text-sm">
                {highestRatingWinner.avgRating.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-400">
                ({highestRatingWinner.totalReviews})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Crew Standings Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 uppercase tracking-wider">
            Technician Crew Scorecard & Verified Ratings
          </span>
          <span className="text-[11px] text-slate-400">Ranked by overall operational efficiency</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-white border-b border-slate-100 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3">Rank & Crew Member</th>
              <th className="px-3 py-3 text-right">Jobs Completed</th>
              <th className="px-3 py-3 text-right">Avg. P&L Margin</th>
              <th className="px-3 py-3 text-right">Customer Rating</th>
              <th className="px-3 py-3 text-right">On-Time Arrival</th>
              <th className="px-4 py-3">Recent Client Testimonial</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedTechnicians.map((p, idx) => (
              <tr
                key={p.tech.id}
                onClick={() => onSelectTechnician && onSelectTechnician(p.tech.id)}
                className="hover:bg-slate-50/75 transition-colors cursor-pointer group"
              >
                {/* Rank & Profile */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                        idx === 0
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : idx === 1
                          ? 'bg-slate-200 text-slate-800'
                          : idx === 2
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <img
                      src={p.tech.avatarUrl}
                      alt={p.tech.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />

                    <div>
                      <div className="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                        {p.tech.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.badge} · {p.tech.specialties[0]}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Jobs Completed */}
                <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                  {p.jobsCompleted}
                </td>

                {/* Avg Margin % */}
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  <span
                    className={`font-bold ${
                      p.avgMarginPercent >= 45
                        ? 'text-emerald-600'
                        : p.avgMarginPercent >= 30
                        ? 'text-slate-900'
                        : 'text-amber-600'
                    }`}
                  >
                    {p.avgMarginPercent}%
                  </span>
                  <div className="text-[10px] text-slate-400">
                    {formatZAR(p.totalGrossProfitZAR)} profit
                  </div>
                </td>

                {/* Customer Rating */}
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  <div className="flex items-center justify-end gap-1 font-bold text-slate-900">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                    <span>{p.avgRating.toFixed(2)}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">({p.totalReviews} reviews)</div>
                </td>

                {/* On-Time Arrival */}
                <td className="px-3 py-3 text-right font-mono tabular-nums">
                  <span
                    className={`font-bold ${
                      p.onTimeRate >= 95 ? 'text-emerald-600' : 'text-slate-800'
                    }`}
                  >
                    {p.onTimeRate}%
                  </span>
                </td>

                {/* Testimonial snippet */}
                <td className="px-4 py-3 max-w-xs">
                  <p className="text-[11px] text-slate-600 italic line-clamp-2">
                    {p.recentTestimonial}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
