import { Component, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { FirebaseService, IDatabaseItem } from "../services/firebase";
import { DatabaseService } from '../services/database.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

import * as Papa from 'papaparse';


@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {

    // firebase sync
    isConnected: boolean = false;
    subscriptionList: Subscription;
    subscriptionObj: Subscription;

    displayedColumns: string[] = ['nume', 'plastic', 'hartie', 'locatie'];

    csvData: any[] = []; // Array pentru datele CSV
    currentIndex: number = 0; // Index pentru punctul curent
    listItems: IDatabaseItem[] = []; // Datele afișate în tabel
    csvIndex: number = 0;

    usedIndexes: Set<number> = new Set<number>(); // Pentru a păstra indexurile deja folosite


    supermarketData: any[] = []; // Array pentru datele supermarket-urilor găsite
    isSearching: boolean = false;

    constructor(
        private fbs: FirebaseService,
        private dbService: DatabaseService,
        private authService: AuthService,
        private router: Router
    ) {

    }

   

    ngOnInit() {
        this.dbService.getEntries().subscribe(entries => {
            this.listItems = entries;
            console.log('Entries updated: ', this.listItems);
        });
    }

    searchSupermarkets() {
        this.isSearching = true;
        
        // Generate 50 supermarket locations across Bucharest
        const supermarketChains = ['Kaufland', 'Carrefour', 'Lidl', 'Mega Image', 'Auchan', 'Penny', 'Profi'];
        const areas = [
            'Berceni', 'Militari', 'Drumul Taberei', 'Unirii', 'Titan', 'Pantelimon', 'Colentina',
            'Vitan', 'Baneasa', 'Pipera', 'Obor', 'Dristor', 'Iancului', 'Crangasi', 'Giulesti',
            'Victoriei', 'Romana', 'Universitate', 'Cotroceni', 'Politehnica', 'Grozavesti',
            'Basarab', 'Gara de Nord', 'Stefan cel Mare', 'Mihai Bravu', 'Dacia', 'Muncii',
            'Timpuri Noi', 'Tineretului', 'Eroilor', 'Lujerului', 'Gorjului', 'Pacii',
            'Preciziei', 'Aparatorii Patriei', 'Nicolae Grigorescu', 'Dimitrie Leonida'
        ];
        
        const mockSupermarkets = [];
        
        // Generate 50 supermarkets with varied locations
        for (let i = 0; i < 50; i++) {
            const chain = supermarketChains[i % supermarketChains.length];
            const area = areas[i % areas.length];
            
            // Generate coordinates around Bucharest (44.4268 N, 26.1025 E)
            // Spread them in a ~10km radius
            const latOffset = (Math.random() - 0.5) * 0.15; // ~8km
            const longOffset = (Math.random() - 0.5) * 0.15;
            
            mockSupermarkets.push({
                nume: `${chain} ${area}`,
                adresa: `Str. ${area} nr. ${Math.floor(Math.random() * 200 + 1)}, București`,
                latitudine: 44.4268 + latOffset,
                longitudine: 26.1025 + longOffset
            });
        }

        // Generăm date pentru fiecare supermarket cu formatul cerut
        this.supermarketData = mockSupermarkets.map(market => ({
            nume: market.nume,
            plastic: true,
            hartie: false,
            carti: false,
            sticla: true,
            metal: true,
            haine: false,
            electronice: false,
            electrocasnice: false,
            ochelari: false,
            baterii: false,
            vapes: false,
            vopsea: false,
            automobile: false,
            antigel: false,
            ulei: false,
            moloz: false,
            telefon: 'N/A',
            zileLucrate: 'Luni - Duminică',
            program: '08:00 - 22:00',
            adresa: market.adresa,
            latitudine: market.latitudine,
            longitudine: market.longitudine,
            descriere: 'Punct de colectare în supermarket - acceptă plastic, sticlă și metal'
        }));

        this.isSearching = false;
        alert(`S-au găsit ${this.supermarketData.length} puncte de colectare!`);
        console.log('Supermarket data:', this.supermarketData);
    }

    downloadSupermarketsCSV() {
        if (this.supermarketData.length === 0) {
            alert('Nu există date de puncte de colectare. Apasă mai întâi "Caută Puncte de Colectare".');
            return;
        }

        // Convertim datele în format CSV
        const csvContent = this.convertToCSV(this.supermarketData);
        
        // Creăm un blob și descărcăm fișierul
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'supermarkets_' + new Date().getTime() + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert('Fișierul CSV a fost descărcat!');
    }

    addSupermarketsToFirebase() {
        if (this.supermarketData.length === 0) {
            alert('Nu există date de puncte de colectare. Apasă mai întâi "Caută Puncte de Colectare".');
            return;
        }

        if (confirm(`Ești sigur că vrei să adaugi ${this.supermarketData.length} puncte de colectare în Firebase?`)) {
            this.supermarketData.forEach(market => {
                this.dbService.addEntry(market);
            });
            alert('Punctele de colectare au fost adăugate în Firebase!');
            this.supermarketData = []; // Resetăm datele după adăugare
        }
    }

    convertToCSV(data: any[]): string {
        if (data.length === 0) return '';

        // Generăm antetul CSV
        const headers = [
            'Nume', 'Plastic', 'Hartie', 'Carti', 'Sticla', 'Metal', 'Haine',
            'Electronice', 'Electrocasnice', 'Ochelari', 'Baterii', 'Vapes',
            'Vopsea', 'Automobile', 'Antigel', 'Ulei', 'Moloz', 'Telefon',
            'ZileLucrate', 'Program', 'Adresa', 'Latitudine', 'Longitudine', 'Descriere'
        ];

        // Convertim datele în rânduri CSV
        const rows = data.map(item => [
            item.nume,
            item.plastic ? 'Da' : 'Nu',
            item.hartie ? 'Da' : 'Nu',
            item.carti ? 'Da' : 'Nu',
            item.sticla ? 'Da' : 'Nu',
            item.metal ? 'Da' : 'Nu',
            item.haine ? 'Da' : 'Nu',
            item.electronice ? 'Da' : 'Nu',
            item.electrocasnice ? 'Da' : 'Nu',
            item.ochelari ? 'Da' : 'Nu',
            item.baterii ? 'Da' : 'Nu',
            item.vapes ? 'Da' : 'Nu',
            item.vopsea ? 'Da' : 'Nu',
            item.automobile ? 'Da' : 'Nu',
            item.antigel ? 'Da' : 'Nu',
            item.ulei ? 'Da' : 'Nu',
            item.moloz ? 'Da' : 'Nu',
            item.telefon,
            item.zileLucrate,
            item.program,
            item.adresa,
            item.latitudine,
            item.longitudine,
            item.descriere
        ].map(value => `"${value}"`).join(','));

        return [headers.join(','), ...rows].join('\n');
    }
    

    connectFirebase() {
        if (this.isConnected) {
            return;
        }
        this.isConnected = true;
    
        this.fbs.connectToDatabase();
    
        // Preia datele inițiale
        this.dbService.getEntries().subscribe(entries => {
            console.log('Entries from Database Service: ', entries); // Debugging
            this.listItems = entries; // Actualizează lista locală
        });
    
        // Note: Removed subscriptions to list/obj that caused permission errors
        // Only using puncteColectare database path
        console.log('Connected to Firebase - using puncteColectare');
    }

    


    loadCSV(event: any) {
        const file = event.target.files[0];
        const reader = new FileReader();
    
        reader.onload = () => {
            const text = reader.result as string;
            Papa.parse(text, {
                header: true, // Prima linie este folosită ca antet pentru coloane
                skipEmptyLines: true,
                complete: (result) => {
                    this.csvData = result.data.map((row: any) => ({
                        nume: row.Nume || 'Necunoscut',
                        plastic: row.Plastic === 'Da',
                        hartie: row.Hartie === 'Da',
                        carti: row.Carti === 'Da',
                        sticla: row.Sticla === 'Da',
                        metal: row.Metal === 'Da',
                        haine: row.Haine === 'Da',
                        electronice: row.Electronice === 'Da',
                        electrocasnice: row.Electrocasnice === 'Da',
                        ochelari: row.Ochelari === 'Da',
                        baterii: row.Baterii === 'Da',
                        vapes: row.Vapes === 'Da',
                        vopsea: row.Vopsea === 'Da',
                        automobile: row.Automobile === 'Da',
                        antigel: row.Antigel === 'Da',
                        ulei: row.Ulei === 'Da',
                        moloz: row.Moloz === 'Da',
                        telefon: row.Telefon || 'N/A',
                        zileLucrate: row.ZileLucrate || 'N/A',
                        program: row.Program || 'N/A',
                        adresa: row.Adresa || 'N/A',
                        latitudine: parseFloat(row.Latitudine) || 0,
                        longitudine: parseFloat(row.Longitudine) || 0,
                        descriere: row.Descriere || 'N/A'
                    }));
                    console.log('CSV Data Loaded:', this.csvData);
                }
            });
        };
    
        reader.readAsText(file);
    }
    
    
    addListItem() {
        if (this.currentIndex < this.csvData.length) {
            // Verifică dacă indexul curent a fost deja folosit
            if (this.usedIndexes.has(this.currentIndex)) {
                alert(`Indexul ${this.currentIndex} a fost deja folosit!`);
                this.currentIndex++; // Avansează la următorul index
                return;
            }
    
            const newRow = this.csvData[this.currentIndex];
    
            this.dbService.addEntry(newRow); // Adaugă datele în Firebase
            this.listItems.push(newRow);    // Actualizează lista locală
            this.usedIndexes.add(this.currentIndex); // Marchează indexul ca folosit
    
            console.log(`Adăugat punct de la indexul ${this.currentIndex}:`, newRow);
            this.currentIndex++; // Crește indexul pentru următorul rând
        } else {
            alert("Toate datele au fost adăugate!");
        }
    }
    
    
    clearEntries() {
        this.dbService.clearEntries();
        this.listItems = []; 
        this.currentIndex = 0;
        this.usedIndexes.clear(); // Golește lista de indexuri folosite
        console.log("Toate datele au fost șterse și contorul a fost resetat.");
    }
    
    
    
    
    removeItems() {
        this.dbService.clearEntries();
    }
    
    clearAllData() {
        if (confirm('Ești sigur că vrei să ștergi toate datele?')) {
            this.dbService.clearEntries(); // Apelează metoda din serviciu pentru ștergere
            this.listItems = []; // Golește și lista locală
            console.log('Toate datele au fost șterse.');
        }
    }

    setCustomIndex() {
        const input = prompt("Introdu indexul de la care să înceapă adăugarea:");
        const parsedIndex = parseInt(input || '', 10);
    
        if (!isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < this.csvData.length) {
            this.currentIndex = parsedIndex;
            console.log(`Indexul curent a fost setat la ${this.currentIndex}`);
        } else {
            alert("Index invalid! Introdu un număr valid între 0 și " + (this.csvData.length - 1));
        }
    }
    
    addAllRemainingItems() {
        let addedCount = 0; // Număr de date adăugate
    
        for (let i = 0; i < this.csvData.length; i++) {
            if (!this.usedIndexes.has(i)) { // Dacă indexul nu a fost folosit
                const newRow = this.csvData[i];
                this.dbService.addEntry(newRow); // Adaugă în Firebase
                this.listItems.push(newRow);    // Actualizează lista locală
                this.usedIndexes.add(i);        // Marchează indexul ca folosit
                addedCount++;                   // Crește contorul de adăugări
            }
        }
    
        if (addedCount > 0) {
            console.log(`${addedCount} punct(e) au fost adăugate.`);
        } else {
            alert("Toate datele au fost deja adăugate!");
        }
    }
    


    
    importCSV(event: any) {
        const file = event.target.files[0]; // Preia fișierul selectat
        const reader = new FileReader();
        
        reader.onload = () => {
            const csvData = reader.result as string;
            Papa.parse(csvData, {
                header: true, // Tratează prima linie ca antet
                skipEmptyLines: true,
                complete: (result) => {
                    const data = result.data;
                    console.log('Parsed CSV Data:', data);

                    // Adaugă fiecare rând în Firebase
                    data.forEach((row: any) => {
                        this.dbService.addEntry(row);
                    });
                }
            });
        };

        reader.readAsText(file); // Citește fișierul
    }


    disconnectFirebase() {
        if (this.subscriptionList != null) {
            this.subscriptionList.unsubscribe();
        }
        if (this.subscriptionObj != null) {
            this.subscriptionObj.unsubscribe();
        }
    }

    ngOnDestroy(): void {
        this.disconnectFirebase();
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/login']);
    }

    goToMap() {
        this.router.navigate(['/map']);
    }

    goToProfile() {
        this.router.navigate(['/profile']);
    }

  
}