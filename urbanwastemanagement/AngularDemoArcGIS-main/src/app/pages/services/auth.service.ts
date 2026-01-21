import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore'; // Import necesar
import { User } from '../models/user.model'; // Importă modelul
import { BehaviorSubject, Observable, of } from 'rxjs';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})



export class AuthService {

  private currentUserSubject = new BehaviorSubject<any | null>(null);


  constructor(
    private afAuth: AngularFireAuth,
    private db: AngularFireDatabase,
    private router: Router,

  ) {
    this.afAuth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.db
            .object(`users/${user.uid}`)
            .valueChanges()
            .pipe(
              map((userData) => ({
                ...(user || {}), // Spread pe `user`, dacă este definit
                ...(typeof userData === 'object' && userData !== null ? userData : {}) // Verifică dacă `userData` este un obiect valid
              }))
            );
        } else {
          return of(null);
        }
      })
    ).subscribe((user) => {
      this.currentUserSubject.next(user);
    });
  }

  get currentUser(): Observable<any | null> {
    return this.currentUserSubject.asObservable();
  }

  isAuthenticated(): Observable<boolean> {
    return this.currentUser.pipe(map((user) => !!user));
  }

  async signInWithEmailAndPassword(email: string, password: string): Promise<firebase.auth.UserCredential> {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }

  async getRole(uid: string): Promise<string | null> {
    try {
        const userRef = this.db.database.ref(`users/${uid}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        console.log('Data retrieved for role:', userData); // Debugging - afișează datele preluate

        return userData?.role || null;
    } catch (error) {
        console.error('Error retrieving user role:', error);
        return null;
    }
}


async getCurrentUser(): Promise<any | null> {
    try {
        const user = await this.afAuth.currentUser;
        console.log('Firebase Auth current user:', user); // Debugging
        return user;
    } catch (error) {
        console.error('Error retrieving current user:', error);
        return null;
    }
}

  

  register(email: string, password: string, role: string) {
    return this.afAuth.createUserWithEmailAndPassword(email, password).then((userCredential) => {
      const uid = userCredential.user?.uid;
      if (uid) {
        this.db.object(`users/${uid}`).set({ email, role });
      }
    });
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const snapshot = await this.db.database.ref('users').once('value');
      const users = snapshot.val();
  
      const user = Object.values(users).find((u: any) => u.email === email && u.password === password);
  
      if (user) {
        console.log('Autentificare reușită:', user);
        this.currentUserSubject.next(user); // Setăm utilizatorul curent
        
        // Check daily login for XP reward
        await this.checkDailyLogin(email);
        
        return user;
      } else {
        throw new Error('Credentialele sunt invalide.');
      }
    } catch (error) {
      console.error('Eroare la autentificare:', error);
      throw error;
    }
  }
  

  logout(): void {
    this.afAuth.signOut();
    this.currentUserSubject.next(null);
  }

  

// async logout(): Promise<void> {
//     await this.afAuth.signOut();
//     console.log('Deconectat');
//   }
  
  private userRole = new BehaviorSubject<string | null>(null);



  getUserRole(uid: string): Promise<string | null> {
    return this.db.object<{ role: string }>(`users/${uid}`).valueChanges().toPromise().then(data => data?.role || null);
  }

  ngOnInit() {
    const user = localStorage.getItem('user');
    if (user) {
      this.currentUserSubject.next(JSON.parse(user));
    }
    this.afAuth.authState.subscribe((authUser) => {
      console.log('Auth state change. User: ', authUser);
      if (authUser) {
        localStorage.setItem('user', JSON.stringify(authUser));
      } else {
        localStorage.removeItem('user');
      }
    });
  }

  updateUserData(email: string, data: Partial<User>): Promise<void> {
    return this.db.database
    .ref('users')
    .orderByChild('email')
    .equalTo(email)
    .once('value')
    .then((snapshot) => {
      const userKey = Object.keys(snapshot.val() || {})[0];
      if (userKey) {
        return this.db.object(`users/${userKey}`).update(data);
      } else {
        throw new Error('User not found');
      }
    })
    .catch((error) => {
      console.error('Error updating user by email:', error);
      throw error;
    });
  }

  async addXP(email: string, amount: number, activityType: string, details?: string): Promise<void> {
    try {
      const snapshot = await this.db.database.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const users = snapshot.val();
      const userKey = Object.keys(users || {})[0];
      
      if (userKey) {
        const user = users[userKey];
        const newXP = (user.xp || 0) + amount;
        const newLevel = Math.floor(newXP / 100);
        
        const activity = {
          type: activityType,
          xpGained: amount,
          timestamp: Date.now(),
          details: details || ''
        };

        // Initialize arrays if they don't exist
        let weeklyActivity = user.weeklyActivity || [0, 0, 0, 0, 0, 0, 0];
        let monthlyXP = user.monthlyXP || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        
        // Add XP to today (last position in weekly array)
        weeklyActivity[6] = (weeklyActivity[6] || 0) + amount;

        const currentMonth = new Date().getMonth();
        monthlyXP[currentMonth] = (monthlyXP[currentMonth] || 0) + amount;

        const activityLog = user.activityLog || [];
        activityLog.push(activity);

        await this.db.object(`users/${userKey}`).update({
          xp: newXP,
          level: newLevel,
          activityLog: activityLog,
          weeklyActivity: weeklyActivity,
          monthlyXP: monthlyXP
        });
      }
    } catch (error) {
      console.error('Error adding XP:', error);
    }
  }

  async checkDailyLogin(email: string): Promise<void> {
    try {
      const snapshot = await this.db.database.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const users = snapshot.val();
      const userKey = Object.keys(users || {})[0];
      
      if (userKey) {
        const user = users[userKey];
        
        // Initialize fields for existing users if they don't exist
        const updates: any = {};
        if (user.xp === undefined) updates.xp = 0;
        if (user.level === undefined) updates.level = 0;
        if (!user.activityLog) updates.activityLog = [];
        if (!user.weeklyActivity) updates.weeklyActivity = [0, 0, 0, 0, 0, 0, 0];
        if (!user.monthlyXP) updates.monthlyXP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        if (!user.totalRecyclingTypes) updates.totalRecyclingTypes = {
          plastic: 0,
          hartie: 0,
          sticla: 0,
          metal: 0,
          electronic: 0
        };
        if (user.totalReports === undefined) updates.totalReports = 0;
        if (user.totalVisits === undefined) updates.totalVisits = 0;
        if (user.loginStreak === undefined) updates.loginStreak = 0;
        if (user.longestStreak === undefined) updates.longestStreak = 0;
        
        if (Object.keys(updates).length > 0) {
          await this.db.object(`users/${userKey}`).update(updates);
          Object.assign(user, updates);
        }
        
        const today = new Date().setHours(0, 0, 0, 0);
        const lastLogin = user.lastLoginDate || 0;
        const lastLoginDate = new Date(lastLogin).setHours(0, 0, 0, 0);

        if (lastLoginDate !== today) {
          const oneDayMs = 24 * 60 * 60 * 1000;
          const isConsecutive = (today - lastLoginDate) === oneDayMs;
          
          let newStreak = 1;
          if (isConsecutive) {
            newStreak = (user.loginStreak || 0) + 1;
          }

          const streakBonus = Math.min(Math.floor(newStreak / 7) * 5, 50);
          const baseXP = 10;
          const totalXP = baseXP + streakBonus;

          await this.addXP(email, totalXP, 'login', `Login streak: ${newStreak} days`);
          
          await this.db.object(`users/${userKey}`).update({
            lastLoginDate: Date.now(),
            loginStreak: newStreak,
            longestStreak: Math.max(newStreak, user.longestStreak || 0)
          });
        }
      }
    } catch (error) {
      console.error('Error checking daily login:', error);
    }
  }

  async getGlobalStats(): Promise<any> {
    try {
      const usersSnapshot = await this.db.database.ref('users').once('value');
      const reportsSnapshot = await this.db.database.ref('reports').once('value');
      
      const users = usersSnapshot.val() || {};
      const reports = reportsSnapshot.val() || {};
      
      let totalXP = 0;
      let totalVisits = 0;
      const topUsers: any[] = [];
      const materialStats: any = {
        plastic: 0,
        hartie: 0,
        sticla: 0,
        metal: 0,
        electronic: 0
      };

      Object.values(users).forEach((user: any) => {
        totalXP += user.xp || 0;
        totalVisits += user.activityLog?.filter((a: any) => a.type === 'visit').length || 0;
        
        if (user.totalRecyclingTypes) {
          Object.keys(materialStats).forEach(material => {
            materialStats[material] += user.totalRecyclingTypes[material] || 0;
          });
        }

        topUsers.push({
          username: user.username,
          email: user.email,
          xp: user.xp || 0,
          level: user.level || 0,
          totalReports: user.totalReports || 0
        });
      });

      topUsers.sort((a, b) => b.xp - a.xp);

      return {
        totalUsers: Object.keys(users).length,
        totalReports: Object.keys(reports).length,
        totalVisits: totalVisits,
        totalXP: totalXP,
        topUsers: topUsers.slice(0, 5),
        materialStats: materialStats
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return null;
    }
  }

  async incrementTotalReports(email: string): Promise<void> {
    try {
      const snapshot = await this.db.database.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const users = snapshot.val();
      const userKey = Object.keys(users || {})[0];
      
      if (userKey) {
        const user = users[userKey];
        await this.db.object(`users/${userKey}`).update({
          totalReports: (user.totalReports || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error incrementing total reports:', error);
    }
  }

  async incrementTotalVisits(email: string): Promise<void> {
    try {
      const snapshot = await this.db.database.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const users = snapshot.val();
      const userKey = Object.keys(users || {})[0];
      
      if (userKey) {
        const user = users[userKey];
        await this.db.object(`users/${userKey}`).update({
          totalVisits: (user.totalVisits || 0) + 1
        });
      }
    } catch (error) {
      console.error('Error incrementing total visits:', error);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const snapshot = await this.db.database.ref('users')
        .orderByChild('email')
        .equalTo(email)
        .once('value');
      
      const users = snapshot.val();
      if (users) {
        const userKey = Object.keys(users)[0];
        return users[userKey];
      }
      return null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }
  
}