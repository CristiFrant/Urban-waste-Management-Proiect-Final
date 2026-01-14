import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface IDatabaseItem {
    name: string;
    val: string;
    lat?: number;
    long?: number;
}

export interface IReport {
    id?: string;
    locationId: string;
    locationName: string;
    message: string;
    userEmail: string;
    userName: string;
    timestamp: number;
    latitude: number;
    longitude: number;
}

@Injectable()
export class FirebaseService {

    listFeed: Observable<any[]>;
    objFeed: Observable<any>;

    constructor(public db: AngularFireDatabase) {

    }

    getPuncteColectare(): Observable<any[]> {
        return this.db.list('puncteColectare').valueChanges();
    }

    connectToDatabase() {
        // Using puncteColectare instead of list/obj to avoid permission errors
        this.listFeed = this.db.list('puncteColectare').valueChanges();
        this.objFeed = this.db.object('puncteColectare').valueChanges();
    }

    getChangeFeedList(): Observable<IDatabaseItem[]> {
        // Return empty observable to avoid permission errors
        return new Observable(observer => {
            observer.next([]);
            observer.complete();
        });
    }

    getChangeFeedObject() {
        // Return empty observable to avoid permission errors
        return new Observable(observer => {
            observer.next(null);
            observer.complete();
        });
    }

    removeListItems() {
        this.db.list('list').remove();
    }

    addListObject(val: string) {
        let item: IDatabaseItem = {
            name: "test",
            val: val
        };
        this.db.list('list').push(item);
    }

    // addlistobject 2 should have longitudes and latitudes
    addListObject2(val: string, lat: number, long: number) {
        let item: IDatabaseItem = {
            name: "test",
            val: val,
            lat: lat,
            long: long
        };
        this.db.list('list').push(item);
    }
    

    updateObject(val: string) {
        let item: IDatabaseItem = {
            name: "test",
            val: val
        };
        this.db.object('obj').set([item]);
    }

    setUserPosition(lat: number, long: number) {
        let item: IDatabaseItem = {
            name: "test",
            val: "test",
            lat: lat,
            long: long
        };
        this.db.object('user').set(item);
    }

    // Report Methods
    addReport(report: IReport): Promise<any> {
        return this.db.list('reports').push(report).then();
    }

    getReports(): Observable<IReport[]> {
        return this.db.list('reports').snapshotChanges().pipe(
            map(changes => 
                changes.map(c => ({
                    id: c.payload.key,
                    ...c.payload.val() as IReport
                }))
            )
        );
    }

    getReportsByLocation(locationId: string): Observable<IReport[]> {
        return this.getReports().pipe(
            map(reports => reports.filter(r => r.locationId === locationId))
        );
    }

    getReportsByUser(userEmail: string): Observable<IReport[]> {
        return this.getReports().pipe(
            map(reports => reports.filter(r => r.userEmail === userEmail))
        );
    }

    deleteReport(reportId: string): Promise<void> {
        return this.db.object(`reports/${reportId}`).remove();
    }
}
