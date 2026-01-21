import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { FirebaseService, IReport } from '../services/firebase';
import { User } from '../models/user.model';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
    user: User | null = null;

    profile = {
        username: 'john_doe',
        phone: '+1 (123) 456-7890',
        email: 'john.doe@example.com',
        password: "",
        role: "customer",
        counter: 0,
        rankName: "",
        rankUrl: "https://via.placeholder.com/100"
    };

    isEditing: boolean = false;
    isChangingPassword: boolean = false;
    passwordData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    };
    passwordError: string = '';
    passwordSuccess: string = '';
    saveSuccess: string = '';
    saveError: string = '';

    supportEmail: string = 'supportwastemanagement@gmail.com';
    userReports: IReport[] = [];

    constructor(
        private authService: AuthService,
        private router: Router,
        private firebaseService: FirebaseService
    ) {}

    async ngOnInit(): Promise<void> {
        // Subscribe to current user AND refresh from Firebase
        this.authService.currentUser.subscribe(async (user) => {
            if (user) {
                // Refresh user data from Firebase to get latest XP/stats
                try {
                    this.user = await this.authService.getUserByEmail(user.email);
                    
                    if (this.user) {
                        // Update profile with fresh data
                        this.profile.username = this.user.username || '';
                        this.profile.phone = this.user.phone || '';
                        this.profile.email = this.user.email || '';
                        this.profile.password = this.user.password || '';
                        this.profile.role = this.user.role || 'customer';
                        this.profile.counter = this.user.totalVisits || this.user.visits || 0;

                        console.log('Profile data refreshed from Firebase:', {
                            email: this.user.email,
                            xp: this.user.xp,
                            level: this.user.level,
                            totalVisits: this.user.totalVisits,
                            totalReports: this.user.totalReports
                        });

                        this.updateRank(this.user.level || 0);

                        // Load user's reports
                        this.firebaseService.getReportsByUser(this.user.email).subscribe(reports => {
                            this.userReports = reports.sort((a, b) => b.timestamp - a.timestamp);
                        });
                    }
                } catch (error) {
                    console.error('Error refreshing user data:', error);
                    // Fallback to cached user data
                    this.user = user;
                    this.profile.username = user.username || '';
                    this.profile.phone = user.phone || '';
                    this.profile.email = user.email || '';
                    this.profile.password = user.password || '';
                    this.profile.role = user.role || 'customer';
                    this.profile.counter = user.totalVisits || user.visits || 0;
                    this.updateRank(user.level || 0);
                    
                    this.firebaseService.getReportsByUser(user.email).subscribe(reports => {
                        this.userReports = reports.sort((a, b) => b.timestamp - a.timestamp);
                    });
                }
            }
        });
    }

    updateRank(level: number): void {
        // Rank based on XP level (same as dashboard)
        if (level < 5) {
            this.profile.rankName = 'Noobie';
            this.profile.rankUrl = 'assets/images/noob.png';
        } 
        else if (level < 10) 
        {
            this.profile.rankName = 'Rookie';
            this.profile.rankUrl = 'assets/images/entry.png';
        } 
        else if (level < 20) 
        {
            this.profile.rankName = 'Apprentice';
            this.profile.rankUrl = 'assets/images/medium.png';
        }
        else if (level < 30) 
        {
            this.profile.rankName = 'Expert';
            this.profile.rankUrl = 'assets/images/entry.png';
        } 
        else if (level < 50) 
        {
            this.profile.rankName = 'Pro';
            this.profile.rankUrl = 'assets/images/theRecycler.png';
        } 
        else 
        {
            this.profile.rankName = 'Master Recycler';
            this.profile.rankUrl = 'assets/images/boss.png';
        }
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

    editProfile(): void {
        this.isEditing = true;
    }

    saveProfile(): void {
        if (this.isEditing) {
            this.saveSuccess = '';
            this.saveError = '';

            // Pregătește datele actualizate
            const updatedData = {
                username: this.profile.username,
                phone: this.profile.phone
            };

            // Apelează serviciul pentru a salva datele
            this.authService.updateUserData(this.profile.email, updatedData).then(() => {
                console.log('Profile updated successfully:', updatedData);
                this.saveSuccess = 'Profilul a fost actualizat cu succes!';
                this.isEditing = false;
                
                setTimeout(() => {
                    this.saveSuccess = '';
                }, 3000);
            }).catch((error) => {
                console.error('Error updating profile:', error);
                this.saveError = 'Eroare la actualizarea profilului. Vă rugăm încercați din nou.';
            });
        }
    }

    cancelEdit(): void {
        this.isEditing = false;
        this.saveSuccess = '';
        this.saveError = '';
        // Reset changes
        if (this.user) {
            this.profile.username = this.user.username || '';
            this.profile.phone = this.user.phone || '';
        }
    }

    togglePasswordChange(): void {
        this.isChangingPassword = !this.isChangingPassword;
        this.passwordError = '';
        this.passwordSuccess = '';
        this.passwordData = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        };
    }

    changePassword(): void {
        this.passwordError = '';
        this.passwordSuccess = '';

        // Validate current password
        if (this.passwordData.currentPassword !== this.profile.password) {
            this.passwordError = 'Parola curentă este incorectă!';
            return;
        }

        // Validate new password
        if (this.passwordData.newPassword.length < 6) {
            this.passwordError = 'Noua parolă trebuie să aibă cel puțin 6 caractere!';
            return;
        }

        // Validate password confirmation
        if (this.passwordData.newPassword !== this.passwordData.confirmPassword) {
            this.passwordError = 'Noua parolă și confirmarea nu coincid!';
            return;
        }

        // Update password
        const updatedData = {
            password: this.passwordData.newPassword
        };

        this.authService.updateUserData(this.profile.email, updatedData).then(() => {
            console.log('Password updated successfully');
            this.passwordSuccess = 'Parola a fost schimbată cu succes!';
            this.profile.password = this.passwordData.newPassword;
            
            // Reset form after 2 seconds
            setTimeout(() => {
                this.togglePasswordChange();
            }, 2000);
        }).catch((error) => {
            console.error('Error updating password:', error);
            this.passwordError = 'Eroare la schimbarea parolei. Vă rugăm încercați din nou.';
        });
    }

    contactSupport(): void {
        const subject = encodeURIComponent('Suport - Waste Management App');
        const body = encodeURIComponent(
            `Bună ziua,\n\n` +
            `Am nevoie de ajutor cu următoarea problemă:\n\n` +
            `[Descrieți problema aici]\n\n` +
            `Detalii cont:\n` +
            `Email: ${this.profile.email}\n` +
            `Username: ${this.profile.username}\n\n` +
            `Mulțumesc!`
        );
        window.location.href = `mailto:${this.supportEmail}?subject=${subject}&body=${body}`;
    }

    goToMap(): void {
        this.router.navigate(['/map']);
    }

    goToDashboard(): void {
        this.router.navigate(['/dashboard']);
    }

    goToHome(): void {
        this.router.navigate(['/home']);
    }

    logout(): void {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    cancelPasswordChange(): void {
        this.togglePasswordChange();
    }

    deleteUserReport(reportId: string): void {
        if (confirm('Sigur vrei să ștergi acest raport?')) {
            this.firebaseService.deleteReport(reportId).then(() => {
                alert('Raportul a fost șters cu succes!');
            }).catch(error => {
                console.error('Error deleting report:', error);
                alert('Eroare la ștergerea raportului.');
            });
        }
    }

    formatDate(timestamp: number): string {
        return new Date(timestamp).toLocaleString('ro-RO');
    }

    incrementVisitedLocations(): void {
        if (this.user && this.user.email) {
          const newCount = (this.user.visits || 0) + 1;
    
          // Actualizează baza de date și contorul local
          this.authService.updateUserData(this.user.email, { visits: newCount });
          this.user.visits = newCount;
          this.updateRank(newCount);
        }
      }
}
