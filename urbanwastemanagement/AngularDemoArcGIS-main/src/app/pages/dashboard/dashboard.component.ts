import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  user: User | null = null;
  globalStats: any = null;
  loading = true;

  // XP Progress Line Chart
  xpChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      label: 'XP Progress',
      data: [],
      borderColor: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };
  xpChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: true, text: 'Experience Progress' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };
  xpChartType: ChartType = 'line';

  // Materials Pie Chart
  materialsChartData: ChartData<'doughnut'> = {
    labels: ['Plastic', 'Hârtie', 'Sticlă', 'Metal', 'Electronic'],
    datasets: [{
      data: [],
      backgroundColor: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF'
      ]
    }]
  };
  materialsChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' },
      title: { display: true, text: 'Materials Recycled' }
    }
  };
  materialsChartType: ChartType = 'doughnut';

  // Weekly Activity Bar Chart
  weeklyChartData: ChartData<'bar'> = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'XP Gained',
      data: [],
      backgroundColor: '#2196F3'
    }]
  };
  weeklyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Weekly Activity' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };
  weeklyChartType: ChartType = 'bar';

  // Monthly XP Bar Chart
  monthlyChartData: ChartData<'bar'> = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [{
      label: 'Monthly XP',
      data: [],
      backgroundColor: '#FF9800'
    }]
  };
  monthlyChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Monthly XP Progress' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };
  monthlyChartType: ChartType = 'bar';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadUserData();
    this.loadGlobalStats();
  }

  async refreshData(): Promise<void> {
    this.loading = true;
    await Promise.all([
      this.loadUserData(),
      this.loadGlobalStats()
    ]);
    this.loading = false;
  }

  async loadUserData(): Promise<void> {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const authUser = JSON.parse(userStr);
      
      try {
        this.user = await this.authService.getUserByEmail(authUser.email);
        if (this.user) {
          this.prepareCharts();
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }
  }

  async loadGlobalStats(): Promise<void> {
    this.globalStats = await this.authService.getGlobalStats();
    this.loading = false;
  }

  prepareCharts(): void {
    if (!this.user) return;

    console.log('Preparing charts with user data:', {
      xp: this.user.xp,
      level: this.user.level,
      activityLogLength: this.user.activityLog?.length || 0,
      totalReports: this.user.totalReports,
      totalVisits: this.user.totalVisits,
      weeklyActivity: this.user.weeklyActivity,
      monthlyXP: this.user.monthlyXP
    });

    // XP Progress - Build from activity log
    const xpData = this.user.activityLog || [];
    if (xpData.length > 0) {
      // Get activities from last 30 days or all if less
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
      const recentActivities = xpData.filter(a => a.timestamp >= thirtyDaysAgo);
      
      if (recentActivities.length > 0) {
        // Calculate cumulative XP starting from initial value
        const totalRecentXP = recentActivities.reduce((sum, a) => sum + a.xpGained, 0);
        let startXP = (this.user.xp || 0) - totalRecentXP;
        
        // Group by date for cleaner chart
        const dateMap = new Map<string, number>();
        recentActivities.forEach(a => {
          const date = new Date(a.timestamp);
          const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
          dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + a.xpGained);
        });
        
        // Build cumulative data
        const labels: string[] = [];
        const data: number[] = [];
        let cumulative = startXP;
        
        dateMap.forEach((xpGain, dateKey) => {
          cumulative += xpGain;
          labels.push(dateKey);
          data.push(cumulative);
        });
        
        // Create new object to trigger change detection
        this.xpChartData = {
          labels: labels,
          datasets: [{
            label: 'XP Progress',
            data: data,
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4
          }]
        };
      } else {
        // Show current XP as single point
        const today = new Date();
        this.xpChartData = {
          labels: [`${today.getMonth() + 1}/${today.getDate()}`],
          datasets: [{
            label: 'XP Progress',
            data: [this.user.xp || 0],
            borderColor: '#4CAF50',
            backgroundColor: 'rgba(76, 175, 80, 0.1)',
            fill: true,
            tension: 0.4
          }]
        };
      }
    } else {
      // No activity yet - show current XP
      const today = new Date();
      this.xpChartData = {
        labels: [`${today.getMonth() + 1}/${today.getDate()}`],
        datasets: [{
          label: 'XP Progress',
          data: [this.user.xp || 0],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: true,
          tension: 0.4
        }]
      };
    }

    // Materials - Calculate from activity log if totalRecyclingTypes is empty
    if (this.user.totalRecyclingTypes) {
      const hasData = Object.values(this.user.totalRecyclingTypes).some(v => (v || 0) > 0);
      if (hasData) {
        this.materialsChartData = {
          labels: ['Plastic', 'Hârtie', 'Sticlă', 'Metal', 'Electronic'],
          datasets: [{
            data: [
              this.user.totalRecyclingTypes.plastic || 0,
              this.user.totalRecyclingTypes.hartie || 0,
              this.user.totalRecyclingTypes.sticla || 0,
              this.user.totalRecyclingTypes.metal || 0,
              this.user.totalRecyclingTypes.electronic || 0
            ],
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF'
            ]
          }]
        };
      } else {
        // Generate sample data based on reports count
        const reports = this.user.totalReports || 0;
        if (reports > 0) {
          this.materialsChartData = {
            labels: ['Plastic', 'Hârtie', 'Sticlă', 'Metal', 'Electronic'],
            datasets: [{
              data: [
                Math.floor(reports * 0.4), // plastic
                Math.floor(reports * 0.25), // hartie
                Math.floor(reports * 0.15), // sticla
                Math.floor(reports * 0.1),  // metal
                Math.floor(reports * 0.1)   // electronic
              ],
              backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF'
              ]
            }]
          };
        } else {
          this.materialsChartData = {
            labels: ['Plastic', 'Hârtie', 'Sticlă', 'Metal', 'Electronic'],
            datasets: [{
              data: [0, 0, 0, 0, 0],
              backgroundColor: [
                '#FF6384',
                '#36A2EB',
                '#FFCE56',
                '#4BC0C0',
                '#9966FF'
              ]
            }]
          };
        }
      }
    } else {
      this.materialsChartData = {
        labels: ['Plastic', 'Hârtie', 'Sticlă', 'Metal', 'Electronic'],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF'
          ]
        }]
      };
    }

    // Weekly Activity - Calculate from activity log
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];
    if (this.user.weeklyActivity && this.user.weeklyActivity.some(v => v > 0)) {
      this.weeklyChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'XP Gained',
          data: [...this.user.weeklyActivity],
          backgroundColor: '#2196F3'
        }]
      };
      console.log('Weekly activity from user data:', this.user.weeklyActivity);
    } else if (xpData.length > 0) {
      // Calculate from last 7 days of activity
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const weekActivities = xpData.filter(a => a.timestamp >= sevenDaysAgo);
      
      weekActivities.forEach(activity => {
        const daysAgo = Math.floor((now - activity.timestamp) / (24 * 60 * 60 * 1000));
        const dayIndex = 6 - daysAgo; // 6 = today, 0 = 7 days ago
        if (dayIndex >= 0 && dayIndex < 7) {
          weeklyData[dayIndex] += activity.xpGained;
        }
      });
      
      this.weeklyChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'XP Gained',
          data: weeklyData,
          backgroundColor: '#2196F3'
        }]
      };
      console.log('Weekly activity calculated:', weeklyData);
    } else {
      this.weeklyChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'XP Gained',
          data: weeklyData,
          backgroundColor: '#2196F3'
        }]
      };
    }

    // Monthly XP - Calculate from activity log
    const monthlyData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (this.user.monthlyXP && this.user.monthlyXP.some(v => v > 0)) {
      this.monthlyChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Monthly XP',
          data: [...this.user.monthlyXP],
          backgroundColor: '#FF9800'
        }]
      };
      console.log('Monthly XP from user data:', this.user.monthlyXP);
    } else if (xpData.length > 0) {
      // Calculate from activity log
      xpData.forEach(activity => {
        const date = new Date(activity.timestamp);
        const month = date.getMonth();
        monthlyData[month] += activity.xpGained;
      });
      
      this.monthlyChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Monthly XP',
          data: monthlyData,
          backgroundColor: '#FF9800'
        }]
      };
      console.log('Monthly XP calculated:', monthlyData);
    } else {
      this.monthlyChartData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Monthly XP',
          data: monthlyData,
          backgroundColor: '#FF9800'
        }]
      };
    }
  }

  getRankName(): string {
    const level = this.user?.level || 0;
    if (level < 5) return 'Noobie';
    if (level < 10) return 'Rookie';
    if (level < 20) return 'Apprentice';
    if (level < 30) return 'Expert';
    if (level < 50) return 'Pro';
    return 'Master Recycler';
  }

  getXPToNextLevel(): number {
    const currentLevel = this.user?.level || 0;
    const currentXP = this.user?.xp || 0;
    const nextLevelXP = (currentLevel + 1) * 100;
    return nextLevelXP - currentXP;
  }

  getProgressPercentage(): number {
    const currentLevel = this.user?.level || 0;
    const currentXP = this.user?.xp || 0;
    const currentLevelXP = currentLevel * 100;
    const nextLevelXP = (currentLevel + 1) * 100;
    const progress = ((currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    return Math.min(100, Math.max(0, progress));
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
