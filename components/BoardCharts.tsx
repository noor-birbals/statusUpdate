'use client';

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { PALETTE } from '@/lib/constants';
import type { BoardStats } from '@/lib/types';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

const donutOpts = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'right' as const,
      labels: { font: { size: 11 }, padding: 8, usePointStyle: true, pointStyleWidth: 8 },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { label?: string; raw?: unknown; dataset: { data: number[] } }) => {
          const raw = Number(ctx.raw);
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          return ` ${ctx.label}: ${raw} (${total ? Math.round((raw / total) * 100) : 0}%)`;
        },
      },
    },
  },
};

const barOpts = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: {
    legend: { labels: { font: { size: 11 }, usePointStyle: true, pointStyleWidth: 8 } },
  },
  scales: {
    x: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#F4F5F7' }, stacked: true },
    y: { ticks: { font: { size: 11 } }, grid: { display: false }, stacked: true },
  },
};

function sortedEntries(counts: Record<string, number>, limit?: number) {
  const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return (limit ? keys.slice(0, limit) : keys).map((k) => ({ key: k, value: counts[k] }));
}

interface Props {
  boardId: string;
  stats: BoardStats;
  showProjects?: boolean;
}

export default function BoardCharts({ boardId, stats, showProjects }: Props) {
  const statusEntries = sortedEntries(stats.statusCounts);
  const typeEntries = sortedEntries(stats.typeCounts);
  const projectEntries = sortedEntries(stats.projectCounts, 10);
  const assignees = sortedEntries(stats.assigneeCounts, 15).map((e) => e.key);

  return (
    <>
      <div className="chart-grid">
        <div className="chart-card">
          <div className="chart-title">Sprint Completion</div>
          <div className="chart-wrap" style={{ height: 210 }}>
            <Doughnut
              data={{
                labels: ['Done', 'In Progress', 'Review/QA', 'To Do', 'Blocked'],
                datasets: [{
                  data: [stats.done, stats.inprog, stats.review, stats.todo, stats.blocked],
                  backgroundColor: ['#00875A', '#0052CC', '#FF8B00', '#97A0AF', '#DE350B'],
                  borderWidth: 2,
                  borderColor: '#fff',
                }],
              }}
              options={donutOpts}
            />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">Status Breakdown</div>
          <div className="chart-wrap" style={{ height: 210 }}>
            <Doughnut
              data={{
                labels: statusEntries.map((e) => e.key),
                datasets: [{
                  data: statusEntries.map((e) => e.value),
                  backgroundColor: statusEntries.map((_, i) => PALETTE[i % PALETTE.length]),
                  borderWidth: 2,
                  borderColor: '#fff',
                }],
              }}
              options={donutOpts}
            />
          </div>
        </div>
        <div className="chart-card">
          <div className="chart-title">{showProjects ? 'Projects Split' : 'Issue Types'}</div>
          <div className="chart-wrap" style={{ height: 210 }}>
            <Doughnut
              data={{
                labels: (showProjects ? projectEntries : typeEntries).map((e) => e.key),
                datasets: [{
                  data: (showProjects ? projectEntries : typeEntries).map((e) => e.value),
                  backgroundColor: (showProjects ? projectEntries : typeEntries).map((_, i) => PALETTE[i % PALETTE.length]),
                  borderWidth: 2,
                  borderColor: '#fff',
                }],
              }}
              options={donutOpts}
            />
          </div>
        </div>
      </div>
      <div className="workload-card">
        <div className="chart-title">
          Workload per Team Member <span className="chart-sub">issues in sprint</span>
        </div>
        <div style={{ height: 250 }}>
          <Bar
            data={{
              labels: assignees,
              datasets: [
                { label: 'Done', data: assignees.map((a) => stats.assigneeStackData[a]?.done || 0), backgroundColor: '#00875A' },
                { label: 'In Progress', data: assignees.map((a) => stats.assigneeStackData[a]?.inprogress || 0), backgroundColor: '#0052CC' },
                { label: 'Review/QA', data: assignees.map((a) => stats.assigneeStackData[a]?.review || 0), backgroundColor: '#FF8B00' },
                { label: 'To Do', data: assignees.map((a) => stats.assigneeStackData[a]?.todo || 0), backgroundColor: '#97A0AF' },
                { label: 'Blocked', data: assignees.map((a) => stats.assigneeStackData[a]?.blocked || 0), backgroundColor: '#DE350B' },
              ],
            }}
            options={barOpts}
          />
        </div>
      </div>
    </>
  );
}
