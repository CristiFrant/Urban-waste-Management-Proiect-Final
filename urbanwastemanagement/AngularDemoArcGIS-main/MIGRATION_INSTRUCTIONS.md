# Migration Instructions for Existing Users

## Problem
Graficele dashboard-ului sunt goale pentru utilizatorii existenți deoarece aceștia nu au câmpurile noi (xp, activityLog, weeklyActivity, monthlyXP, totalRecyclingTypes).

## Solution
Am implementat două mecanisme de inițializare:

### 1. **Auto-initialization la Login** (RECOMANDAT)
Când un utilizator existent se loghează, sistemul detectează automat lipsa câmpurilor și le inițializează:
- `xp = 0`
- `level = 0`
- `activityLog = []`
- `weeklyActivity = [0, 0, 0, 0, 0, 0, 0]`
- `monthlyXP = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`
- `totalRecyclingTypes = { plastic: 0, hartie: 0, sticla: 0, metal: 0, electronic: 0 }`
- `totalReports = 0`
- `totalVisits = 0`
- `loginStreak = 0`
- `longestStreak = 0`

**Pași:**
1. Utilizatorii trebuie doar să se logheze din nou
2. Sistemul va inițializa automat câmpurile lipsă
3. Dashboard-ul va afișa graficele (deocamdată goale până când acumulează date)

### 2. **Manual Migration Method** (OPȚIONAL)
Am adăugat o metodă `migrateExistingUsers()` în AuthService pentru migrare manuală în masă.

**Pentru a rula migrarea manuală:**

1. Deschide Console în browser (F12)
2. Rulează următorul cod în Console:
```javascript
// Get AuthService instance
const authService = angular.element(document.querySelector('[ng-version]')).injector.get('AuthService');

// Run migration
authService.migrateExistingUsers().then(() => {
  console.log('Migration completed!');
});
```

SAU adaugă temporar un buton în home.component.html:
```html
<button (click)="migrateUsers()" class="migrate-button">
  Migrate Existing Users
</button>
```

Și în home.component.ts:
```typescript
migrateUsers() {
  this.authService.migrateExistingUsers();
}
```

## Ce se întâmplă cu datele existente

- **Datele existente** (email, password, role, visits, phone, username) rămân neschimbate
- **Se adaugă doar** câmpurile noi cu valori default
- **Nu se pierd date** - este o operație sigură

## Verificare după migrare

1. Loghează-te cu un user existent
2. Accesează Dashboard (/dashboard)
3. Verifică că:
   - User profile card se afișează corect
   - Graficele există (vor fi goale până când user-ul acumulează activitate)
   - Stats cards arată 0 pentru utilizatori noi migrati

## Cum încep utilizatorii să acumuleze date

După migrare, utilizatorii vor acumula date automat:
- **Login zilnic**: +10 XP (cu streak bonus)
- **Submit report**: +15 XP + incrementare totalReports
- **Visit location** (prin report): +20 XP + incrementare totalVisits

Graficele se vor popula treptat pe măsură ce utilizatorii folosesc aplicația.

## Note Tehnice

- Inițializarea automată la login este suficientă pentru majoritatea cazurilor
- Migrarea manuală este utilă doar dacă vrei să inițializezi toți utilizatorii dintr-o dată fără să aștepți să se logheze
- După prima inițializare (fie automată, fie manuală), câmpurile vor fi updatate normal de sistem
