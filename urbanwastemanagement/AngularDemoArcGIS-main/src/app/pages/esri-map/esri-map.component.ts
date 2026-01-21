import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
  OnDestroy
} from "@angular/core";
import { Router } from '@angular/router';

import esri = __esri; // Esri TypeScript Types

import esriConfig from '@arcgis/core/config.js';
import Map from "@arcgis/core/Map";
import MapView from '@arcgis/core/views/MapView';
import Bookmarks from '@arcgis/core/widgets/Bookmarks';
import Expand from '@arcgis/core/widgets/Expand';
import Locate from '@arcgis/core/widgets/Locate';
import Search from '@arcgis/core/widgets/Search';
import PopupTemplate from '@arcgis/core/PopupTemplate';

import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

import FeatureSet from '@arcgis/core/rest/support/FeatureSet';
import RouteParameters from '@arcgis/core/rest/support/RouteParameters';
import * as route from "@arcgis/core/rest/route.js";

import Polygon from "@arcgis/core/geometry/Polygon.js";
import Polyline from "@arcgis/core/geometry/Polyline.js";
import * as locator from "@arcgis/core/rest/locator.js";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import Color from "@arcgis/core/Color";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import { FirebaseService, IDatabaseItem, IReport } from "src/app/pages/services/firebase";
import { AuthService } from "src/app/pages/services/auth.service";
import { Subscription } from "rxjs/internal/Subscription";

declare global {
  interface Window {
    createRoute: (lat: number, long: number) => void;
  }
}

@Component({
  selector: "app-esri-map",
  templateUrl: "./esri-map.component.html",
  styleUrls: ["./esri-map.component.scss"]
})
export class EsriMapComponent implements OnInit, OnDestroy {
  @Output() mapLoadedEvent = new EventEmitter<boolean>();

  @ViewChild("mapViewNode", { static: true }) private mapViewEl: ElementRef;

  map: esri.Map;
  view: esri.MapView;
  graphicsLayer: esri.GraphicsLayer;
  graphicsLayerUserPoints: esri.GraphicsLayer;
  graphicsLayerRoutes: esri.GraphicsLayer;
  isConnected: boolean = false;
  subscriptionList: Subscription;
  subscriptionObj: Subscription;
  recyclingPointsLayer: GraphicsLayer;
  routeLayer: GraphicsLayer;
  routeUrl: string = "https://route-api.arcgis.com/arcgis/rest/services/World/Route/NAServer/Route_World";
  userLocation: Point | null = null;
  locateWidget: __esri.Locate | null = null;

  zoom = 10;
  center: Array<number> = [26.1025, 44.4268];
  basemap = "osm"; // OpenStreetMap - works without API key issues
  loaded = false;
  directionsElement: any;

  listItems: IDatabaseItem[] = [];
  currentUser: any = null;
  allReports: IReport[] = [];

  constructor(
    private fbs: FirebaseService,
    private router: Router,
    private authService: AuthService
  ) {
    // Bind createRoute to window so it can be called from popup buttons
    window.createRoute = this.createRoute.bind(this);
    
    // Get current user
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });

    // Load all reports
    this.fbs.getReports().subscribe(reports => {
      this.allReports = reports;
    });
  }

  loadPuncteColectareFromFirebase(): void {
    this.fbs.getPuncteColectare().subscribe((items: any[]) => {
      items.forEach((point) => {
        if (point.latitudine && point.longitudine) {
          this.addPointToMap(point.latitudine, point.longitudine, point.nume, point.descriere, {
            plastic: point.plastic,
            hartie: point.hartie,
            carti: point.carti,
            sticla: point.sticla,
            metal: point.metal,
            haine: point.haine,
            electronice: point.electronice,
            electrocasnice: point.electrocasnice,
            ochelari: point.ochelari,
            baterii: point.baterii,
            vapes: point.vapes,
            vopsea: point.vopsea,
            automobile: point.automobile,
            antigel: point.antigel,
            ulei: point.ulei,
            moloz: point.moloz,
            telefon: point.telefon,
            zileLucrate: point.zileLucrate,
            program: point.program,
            adresa: point.adresa,
          }
        );
        } else {
          console.warn("Invalid point coordinates: ", point);
        }
      });
    });
  }

  ngOnInit() {
    window.createRoute = (lat: number, long: number) => this.createRoute(lat, long); // Asociază metoda locală
    this.initializeMap().then(() => {
      this.loaded = this.view.ready;
      this.mapLoadedEvent.emit(true);
      
      this.connectFirebase();
      this.loadPuncteColectareFromFirebase();
      // loadPointsFromFirebase removed - using only puncteColectare
      // this.view.on("click", (event) => this.addStopPoint(event.mapPoint));
    });
  }

  async initializeMap() {
    try {
      // Set API key for routing and geocoding services using esriConfig
      esriConfig.apiKey = "AAPTxy8BH1VEsoebNVZXo8HurKE-LqnQJv5ZftEj6_bxNtTexlR21IteoGBjFjP44s3sY6xwqlAlIMAp7e0ka10zmd754atJd4Y21ZFR1DvciipS8W62bmd6Zmuebow_nV7O3mCuXBmO9Df2cw5xZ3S2_USdf1H4DSdj42tj3yjVyz_8tY0-mQ0OlzqKMlEDUMWdA8N2p4jXTss4VHoWS-tjd2YEx__CbjJ6tAPYJIR4yWU.AT1_MwiabmZ1";
      
      // Configure request interceptors for better authentication
      esriConfig.request.interceptors.push({
        urls: ["https://route-api.arcgis.com", "https://geocode-api.arcgis.com"],
        before: (params) => {
          params.requestOptions.query = params.requestOptions.query || {};
          params.requestOptions.query.token = esriConfig.apiKey;
        }
      });
  
      // Use Map with OSM basemap (doesn't require API key but routing will use the API key)
      this.map = new Map({
        basemap: this.basemap
      });

      // Create graphics layers AFTER map is created
      this.addGraphicsLayer();
  
      const mapViewProperties = {
        container: this.mapViewEl.nativeElement,
        center: this.center,
        zoom: this.zoom,
        map: this.map,
        ui: { components: ["attribution"] },
      };
      this.view = new MapView(mapViewProperties);
  
      // Wait for view to be ready
      await this.view.when();
      console.log("ArcGIS map loaded successfully with OSM basemap");
  
      // Configurarea popup-ului
      if (this.view.popup.container instanceof HTMLElement) {
        this.view.popup.container.style.maxHeight = "400px";
      }
      this.view.popup.autoOpenEnabled = true;
  
      // Add UI elements after view is ready
      this.addFeatureLayers();
      this.addLocationButton();
      this.addSearchWidget();
      this.addRouting();
      this.filter();
      
      return this.view;
    } catch (error) {
      console.error("Error loading the map: ", error);
      alert("Error loading the map: " + error.message);
    }
  }

  loadPointsFromFirebase(): void {
    // This method is deprecated - now using loadPuncteColectareFromFirebase() only
    // which loads from the 'puncteColectare' path instead of 'list'
    console.log('loadPointsFromFirebase is deprecated - using puncteColectare only');
  }

  addPointToMap(lat: number, long: number, name: string, description: string, details?: any): void {
    const point = new Point({
      latitude: lat,
      longitude: long
    });
  
    const markerSymbol = new SimpleMarkerSymbol({
      color: [0, 150, 136],
      outline: {
        color: [255, 255, 255],
        width: 2
      }
    });

    const recyclableItems = details ? [
      details.plastic ? "plastic" : null,
      details.hartie ? "hartie" : null,
      details.carti ? "carti" : null,
      details.sticla ? "sticla" : null,
      details.metal ? "metal" : null,
      details.haine ? "haine" : null,
      details.electronice ? "electronice" : null,
      details.electrocasnice ? "electrocasnice" : null,
      details.ochelari ? "ochelari" : null,
      details.baterii ? "baterii" : null,
      details.vapes ? "vapes" : null,
      details.vopsea ? "vopsea" : null,
      details.automobile ? "automobile" : null,
      details.antigel ? "antigel" : null,
      details.ulei ? "ulei" : null,
      details.moloz ? "moloz" : null,
    ].filter(item => item !== null).join(", ") : "";

    const popupContent = (): HTMLElement => {
      const container = document.createElement("div");
      if (recyclableItems) {
        const recycleInfo = document.createElement("p");
        recycleInfo.innerHTML = `
                            ${recyclableItems ? `<strong> <span style="font-size: 1.5em; color: green;">Reciclează: </span> </strong> <span style="font-size: 1.4em; color: green;"> ${recyclableItems} </span> <br>` : ""}
                            `;  
        container.appendChild(recycleInfo);
      }
    
      const detailsList = document.createElement("p");
      detailsList.innerHTML = `
        <strong>Telefon:</strong> ${details.telefon || "N/A"}<br>
        <strong>Zile lucrătoare:</strong> ${details.zileLucrate || "N/A"}<br>
        <strong>Program:</strong> ${details.program || "N/A"}<br>
        <strong>Adresa:</strong> ${details.adresa || "N/A"}<br>
        <strong>Descriere:</strong> ${description}
      `;
      container.appendChild(detailsList);

      // Reports section
      const locationId = `${lat}_${long}`;
      const locationReports = this.allReports.filter(r => r.locationId === locationId);
      
      if (locationReports.length > 0) {
        const reportsSection = document.createElement("div");
        reportsSection.className = "reports-section";
        reportsSection.style.cssText = "margin-top: 15px; padding: 10px; background-color: #fff3cd; border-radius: 5px;";
        
        const reportsTitle = document.createElement("strong");
        reportsTitle.innerText = `📢 Rapoarte (${locationReports.length})`;
        reportsTitle.style.cssText = "display: block; margin-bottom: 10px; color: #856404;";
        reportsSection.appendChild(reportsTitle);

        locationReports.forEach(report => {
          const reportItem = document.createElement("div");
          reportItem.style.cssText = "margin-bottom: 10px; padding: 8px; background-color: white; border-left: 3px solid #ffc107; border-radius: 3px;";
          
          const reportHeader = document.createElement("div");
          reportHeader.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;";
          
          const reportUser = document.createElement("small");
          reportUser.innerText = `👤 ${report.userName} - ${new Date(report.timestamp).toLocaleString('ro-RO')}`;
          reportUser.style.cssText = "color: #666; font-size: 11px;";
          reportHeader.appendChild(reportUser);

          // Delete button - only for report owner
          if (this.currentUser && report.userEmail === this.currentUser.email) {
            const deleteBtn = document.createElement("button");
            deleteBtn.innerText = "🗑️";
            deleteBtn.style.cssText = "padding: 2px 6px; background-color: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;";
            deleteBtn.onclick = (e) => {
              e.stopPropagation();
              this.deleteReport(report.id);
            };
            reportHeader.appendChild(deleteBtn);
          }

          reportItem.appendChild(reportHeader);

          const reportMessage = document.createElement("p");
          reportMessage.innerText = report.message;
          reportMessage.style.cssText = "margin: 5px 0 0 0; color: #333; font-size: 13px;";
          reportItem.appendChild(reportMessage);

          reportsSection.appendChild(reportItem);
        });

        container.appendChild(reportsSection);
      }

      // Submit Report Button
      const reportButton = document.createElement("button");
      reportButton.className = "report-button";
      reportButton.innerText = "📝 Raportează o problemă";
      reportButton.style.cssText = "margin-top: 10px; padding: 10px; background-color: #ffc107; color: #333; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-weight: bold;";
      reportButton.onmouseenter = () => { reportButton.style.backgroundColor = "#e0a800"; };
      reportButton.onmouseleave = () => { reportButton.style.backgroundColor = "#ffc107"; };
      reportButton.onclick = () => this.showReportDialog(locationId, name, lat, long);
      container.appendChild(reportButton);
    
      const routeButton = document.createElement("button");
      routeButton.className = "route-button";
      routeButton.innerText = "Creează rută";
      routeButton.onclick = () => window.createRoute(lat, long);
      container.appendChild(routeButton);
    
      return container;
    };
    
    // Atribuie popupContent la popup-ul punctului:
    const pointGraphic = new Graphic({
      geometry: point,
      symbol: markerSymbol,
      attributes: { name, description, recyclables: recyclableItems },
      popupTemplate: {
        title: name,
        content: popupContent
      }
    });

    const popupTemplate = {
      title: "{name}",
      content: (feature) => {
        const container = document.createElement("div");
        container.style.maxHeight = "none"; // Elimină restricția implicită de înălțime
        container.style.overflowY = "visible"; // Asigură vizibilitatea completă
    
        const routeButton = document.createElement("button");
        routeButton.className = "route-button";
        routeButton.innerText = "Creează rută";
        routeButton.style.width = "100%"; // Opțional: forțează lățimea completă pentru buton
        container.appendChild(routeButton);
    
        return container;
      }
    };


    this.graphicsLayer.add(pointGraphic);
  }

  createRoute(lat: number, long: number): void {
    // Închide popup-ul curent (dacă este deschis)
    this.view.popup.close();  

    // Use user location if available, otherwise use default center
    const startPoint = this.userLocation || new Point({
      latitude: this.center[1],
      longitude: this.center[0]
    });
  
    const endPoint = new Point({
      latitude: lat,
      longitude: long
    });

    // Show message about starting point
    if (this.userLocation) {
      console.log("Creating route from your current location");
    } else {
      alert("Pentru a folosi locația ta curentă, apasă butonul de locație din colțul stânga-sus!");
    }
  
    this.calculateRoute([startPoint, endPoint]);
  }

  filter(){
    const recyclableTypes = [
      { key: "plastic", label: "Plastic" },
      { key: "hartie", label: "Hârtie" },
      { key: "carti", label: "Cărți" },
      { key: "sticla", label: "Sticlă" },
      { key: "metal", label: "Metal" },
      { key: "haine", label: "Haine" },
      { key: "electronice", label: "Electronice" },
      { key: "electrocasnice", label: "Electrocasnice" },
      { key: "ochelari", label: "Ochelari" },
      { key: "baterii", label: "Baterii" },
      { key: "vapes", label: "Vapes" },
      { key: "vopsea", label: "Vopsea" },
      { key: "automobile", label: "Automobile" },
      { key: "antigel", label: "Antigel" },
      { key: "ulei", label: "Ulei" },
      { key: "moloz", label: "Moloz" },
    ];

    const filterContainer = document.createElement("div");
    filterContainer.setAttribute("class", "esri-widget");
    filterContainer.setAttribute("style", "padding: 10px; font-family: 'Avenir Next W00'; font-size: 1em");

    const dropdownButton = document.createElement("button");
    dropdownButton.innerText = "Arata filtre";
    dropdownButton.setAttribute("style", "margin-bottom: 10px; cursor: pointer;");

    const filtersDiv = document.createElement("div");
    filtersDiv.style.display = "none";

    dropdownButton.addEventListener("click", () => {
      const isVisible = filtersDiv.style.display === "block";
      filtersDiv.style.display = isVisible ? "none" : "block";
      dropdownButton.innerText = isVisible ? "Arata filtre" : "Ascunde filtre";
    });

    filterContainer.appendChild(dropdownButton);
    filterContainer.appendChild(filtersDiv);

    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = "selectAll";
    selectAllCheckbox.checked = true;

    const selectAllLabel = document.createElement("label");
    selectAllLabel.setAttribute("for", "selectAll");
    selectAllLabel.innerText = "Selectează tot";

    filtersDiv.appendChild(selectAllCheckbox);
    filtersDiv.appendChild(selectAllLabel);

    this.applyFilters();

    const checkboxes: HTMLInputElement[] = [];
    recyclableTypes.forEach((type) => {
      const checkboxContainer = document.createElement("div");

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = type.key;
      checkbox.value = type.key;

      const label = document.createElement("label");
      label.setAttribute("for", type.key);
      label.innerText = type.label;

      checkboxContainer.appendChild(checkbox);
      checkboxContainer.appendChild(label);
      filtersDiv.appendChild(checkboxContainer);

      checkboxes.push(checkbox);

      // Adaugăm un eveniment de schimbare pe checkbox
      checkbox.addEventListener("change", () => {
        if(checkbox.checked){ 
          selectAllCheckbox.checked = false;
        } else {
          const areAllUnchecked = checkboxes.every(cb => !cb.checked);
          if(areAllUnchecked){
            selectAllCheckbox.checked = true;
          }
        }
        this.applyFilters();
      });

    });
    
    selectAllCheckbox.addEventListener("change", () => {
      if (selectAllCheckbox.checked) {
        // Debifăm toate celelalte checkbox-uri
        checkboxes.forEach((cb) => cb.checked = false);
      }
      this.applyFilters();
    });

    this.view.ui.add(filterContainer, "top-left");
  }

  applyFilters() {
    const selectAllCheckbox = document.getElementById("selectAll") as HTMLInputElement;
    const selectedTypes = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
      .map((checkbox: any) => checkbox.value);
  
    if (this.graphicsLayer) {
      this.graphicsLayer.graphics.forEach((graphic) => {
        const graphicRecyclables = graphic.attributes.recyclables || "";
        const recyclablesArray = graphicRecyclables.split(", ").map(item => item.trim());
  
        if (selectAllCheckbox.checked) {
          // Arătăm toate punctele dacă "Selectează toate filtrele" e bifat
          graphic.visible = true;
        } else {
          // Filtrăm punctele pe baza checkbox-urilor selectate
          const matches = selectedTypes.some((type) => recyclablesArray.includes(type));
          graphic.visible = selectedTypes.length === 0 || matches;
        }
      });
    }
  }

  addLocationButton() {
    // Create Locate widget for user location
    this.locateWidget = new Locate({
      view: this.view,
      useHeadingEnabled: false,
      goToOverride: (view, options) => {
        options.target.scale = 1500; // Zoom level when location is found
        return view.goTo(options.target);
      }
    });

    // Add the locate widget to the top left corner of the view
    this.view.ui.add(this.locateWidget, {
      position: "top-left",
      index: 1
    });

    // Track user location when locate is successful
    this.locateWidget.on("locate", (event) => {
      this.userLocation = new Point({
        latitude: event.position.coords.latitude,
        longitude: event.position.coords.longitude
      });
      console.log("User location:", this.userLocation);
    });

    console.log("Location button added");
  }

  addSearchWidget() {
    // Create Search widget - using includeDefaultSources which should work with API key set
    const searchWidget = new Search({
      view: this.view,
      allPlaceholder: "Caută magazine, locații, adrese...",
      popupEnabled: true,
      resultGraphicEnabled: true,
      includeDefaultSources: true
    });

    // Add the search widget to the top right corner
    this.view.ui.add(searchWidget, {
      position: "top-right",
      index: 0
    });

    // When a search result is selected, add navigation action to popup
    searchWidget.on("select-result", (event) => {
      console.log("Search result selected:", event);
      if (event.result && event.result.feature) {
        const geometry = event.result.feature.geometry;
        if (geometry.type === "point") {
          const point = geometry as Point;
          
          // Create a proper PopupTemplate with navigation action
          const existingTemplate = event.result.feature.popupTemplate;
          const popupTemplate = new PopupTemplate({
            title: existingTemplate?.title || event.result.name || "Locație",
            content: existingTemplate?.content || event.result.name || "Rezultat căutare",
            actions: [{
              type: "button",
              title: "Navighează aici",
              id: "navigate-to-location",
              className: "esri-icon-directions"
            }]
          });
          event.result.feature.popupTemplate = popupTemplate;

          // Set up the action handler
          this.view.popup.on("trigger-action", (actionEvent) => {
            if (actionEvent.action.id === "navigate-to-location") {
              this.createRouteToLocation(point.latitude, point.longitude);
            }
          });
        }
      }
    });

    console.log("Search widget added with authentication via esriConfig.apiKey");
  }

  
  createRouteToLocation(lat: number, long: number) {
    // Close any open popup
    this.view.popup.close();

    // Use user location if available, otherwise use default center
    const startPoint = this.userLocation || new Point({
      latitude: this.center[1],
      longitude: this.center[0]
    });

    const endPoint = new Point({
      latitude: lat,
      longitude: long
    });

    // Show message about starting point
    if (this.userLocation) {
      console.log("Creating route from your current location");
    } else {
      console.log("Creating route from map center (click location button to use your position)");
    }

    this.calculateRoute([startPoint, endPoint]);
  }

  addFeatureLayers() {
    // Demo feature layers removed - they were causing errors and aren't needed for recycling app
    // Only using graphics layers for recycling points
    console.log("Graphics layers initialized (demo feature layers removed)");
  }

  addGraphicsLayer() {
    this.graphicsLayer = new GraphicsLayer();
    this.map.add(this.graphicsLayer);
    this.graphicsLayerUserPoints = new GraphicsLayer();
    this.map.add(this.graphicsLayerUserPoints);
    this.graphicsLayerRoutes = new GraphicsLayer();
    this.map.add(this.graphicsLayerRoutes);
    this.recyclingPointsLayer = new GraphicsLayer();
    this.map.add(this.recyclingPointsLayer);
    this.routeLayer = new GraphicsLayer();
    this.map.add(this.routeLayer);
  }

  addStopPoint(mapPoint: Point) {
    const stopSymbol = {
      type: "simple-marker",
      color: this.graphicsLayer.graphics.length === 0 ? "white" : "black",
      size: "8px",
    };
    const stopGraphic = new Graphic({
      geometry: mapPoint,
      symbol: stopSymbol,
    });

    this.graphicsLayer.add(stopGraphic);

    if (this.graphicsLayer.graphics.length === 2) {
      this.getRoute();
    } else if (this.graphicsLayer.graphics.length > 2) {
      this.graphicsLayer.removeAll();
      this.graphicsLayer.add(stopGraphic);
    }
  } 

  resetView() {
    // Elimină direcțiile afișate
    if (this.directionsElement) {
      this.view.ui.remove(this.directionsElement);
      this.directionsElement = null;
    }
  
    // Elimină traseele de pe hartă
    if (this.graphicsLayerRoutes) {
      this.graphicsLayerRoutes.removeAll();
    }
  
    // Elimină punctele utilizatorului
    if (this.graphicsLayerUserPoints) {
      this.graphicsLayerUserPoints.removeAll();
    }
  
    console.log("Traseul și direcțiile au fost eliminate.");

    // Reafișăm filtrul
    const filterContainer = document.querySelector(".esri-widget") as HTMLElement;
    if (filterContainer) {
      filterContainer.style.display = "block"; // Asigurăm că filtrele sunt vizibile din nou
    } else {
      // Dacă filtrul a fost eliminat complet, îl re-adăugăm
      this.filter(); // Reapelăm funcția `filter()` pentru re-creare
    }
  }

  getRoute() {
    const stops = this.graphicsLayer.graphics.toArray();
    const routeParams = new RouteParameters({
      stops: new FeatureSet({
        features: stops,
      }),
      returnDirections: true,
    });

    route.solve(this.routeUrl, routeParams).then((data) => {
      data.routeResults.forEach((result) => {
        result.route.symbol = new SimpleLineSymbol({
          color: new Color([5, 150, 255, 1]), // Folosește Color explicit
        });
        this.graphicsLayer.add(result.route);
      });

      if (data.routeResults.length > 0) {
        this.displayDirections(data.routeResults[0].directions.features);
      }
    });
  }

  displayDirections(directions: any[]) {
    // Creăm containerul pentru direcții
    this.directionsElement = document.createElement("div");
    this.directionsElement.classList.add("esri-widget", "esri-widget--panel", "esri-directions__scroller");
    
    // Setăm poziționarea manuală în partea stângă jos
    this.directionsElement.style.position = "fixed";
    this.directionsElement.style.bottom = "20px";
    this.directionsElement.style.left = "20px";
    this.directionsElement.style.padding = "15px";
    this.directionsElement.style.maxHeight = "200px";
    this.directionsElement.style.overflowY = "auto";
    this.directionsElement.style.backgroundColor = "white";
    this.directionsElement.style.boxShadow = "0px 2px 6px rgba(0, 0, 0, 0.3)";
    this.directionsElement.style.zIndex = "999"; // Ne asigurăm că este deasupra altor elemente UI
  
    const directionsList = document.createElement("ol");
    directions.forEach((step) => {
      const directionStep = document.createElement("li");
      directionStep.innerText = `${step.attributes.text} (${step.attributes.length.toFixed(2)} km)`;
      directionsList.appendChild(directionStep);
    });
  
    // Adăugăm lista la container
    this.directionsElement.appendChild(directionsList);
  
    // Butonul "X" pentru închidere
    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.position = "absolute";
    closeButton.style.top = "5px";
    closeButton.style.right = "5px";
    closeButton.style.background = "red";
    closeButton.style.color = "white";
    closeButton.style.border = "none";
    closeButton.style.padding = "5px";
    closeButton.style.cursor = "pointer";
    closeButton.onclick = () => this.resetView(); // Apelăm `resetView()` pentru a șterge direcțiile și a reafișa filtrele
  
    // Adăugăm butonul la container
    this.directionsElement.appendChild(closeButton);
  
    // Adăugăm containerul în UI
    document.body.appendChild(this.directionsElement); // Atașăm manual la body
  }
  

  removeTraseu() {
    if (this.graphicsLayer) {
      this.graphicsLayer.removeAll();
    }
    this.graphicsLayerRoutes.removeAll(); 
    this.graphicsLayerUserPoints.removeAll();
    this.graphicsLayerUserPoints.graphics.removeAll();
    this.removePoints();

    const directionsElement = document.querySelector(".esri-directions__scroller");
    if (directionsElement) {
      directionsElement.remove();
      console.log("Tabela cu direcții a fost ștearsă.");
    }
  }


  addRouting() {
    // Routing functionality available via popup buttons
    // Click routing on demo layers disabled since they were removed
    console.log("Routing available via popup buttons");
  }

  addPoint(lat: number, lng: number) {
    let point = new Point({
      longitude: lng,
      latitude: lat
    });

    const simpleMarkerSymbol = {
      type: "simple-marker",
      color: [226, 119, 40],  // Orange
      outline: {
        color: [255, 255, 255], // White
        width: 1
      }
    };

    let pointGraphic: esri.Graphic = new Graphic({
      geometry: point,
      symbol: simpleMarkerSymbol
    });

    this.graphicsLayerUserPoints.add(pointGraphic);
  }

  removePoints() {
    this.graphicsLayerUserPoints.removeAll();
  }

  // async calculateRoute(routeUrl: string) {
  //   const routeParams = new RouteParameters({
  //     stops: new FeatureSet({
  //       features: this.graphicsLayerUserPoints.graphics.toArray()
  //     }),
  //     returnDirections: true
  //   });

  //   try {
  //     const data = await route.solve(routeUrl, routeParams);
  //     this.displayRoute(data);
  //   } catch (error) {
  //     console.error("Error calculating route: ", error);
  //     alert("Error calculating route");
  //   }
  // }

  async calculateRoute(points: Point[]): Promise<void> {
    const routeParams = new RouteParameters({
      stops: new FeatureSet({
        features: points.map((point) => new Graphic({ geometry: point }))
      }),
      returnDirections: true,
      directionsLengthUnits: "kilometers"
    });
  
    try {
      console.log("Calculating route from:", points[0], "to:", points[1]);
      
      // Eliminăm toate rutele existente înainte de a crea una nouă
      this.graphicsLayerRoutes.removeAll(); 

      // Use the route service with authentication
      const data = await route.solve(this.routeUrl, routeParams);
      
      if (data && data.routeResults && data.routeResults.length > 0) {
        console.log("Route calculated successfully");
        this.displayRoute(data);
      } else {
        console.error("No route found");
        alert("Nu s-a găsit nicio rută. Verifică dacă ambele locații sunt accesibile.");
      }
    } catch (error) {
      console.error("Full error calculating route: ", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      
      // Check if it's an authentication error
      const errorString = error.toString().toLowerCase();
      if (errorString.includes('token') || errorString.includes('credentials') || errorString.includes('498') || errorString.includes('499')) {
        console.error("Authentication failed. API key might be invalid or expired.");
        alert("Serviciul de rutare necesită autentificare valabilă. Vă rugăm verificați dacă API key-ul este valid și are permisiunile necesare.");
      } else if (errorString.includes('network') || errorString.includes('failed to fetch')) {
        alert("Eroare de rețea. Verifică conexiunea la internet.");
      } else {
        alert("Eroare la calcularea rutei: " + (error.message || error.toString()));
      }
    }
  }

  // displayRoute(data: any) {
  //   for (const result of data.routeResults) {
  //     result.route.symbol = {
  //       type: "simple-line",
  //       color: [5, 150, 255],
  //       width: 3
  //     };
  //     this.graphicsLayerRoutes.graphics.add(result.route);
  //   }
  //   if (data.routeResults.length > 0) {
  //     this.showDirections(data.routeResults[0].directions.features);
  //   } else {
  //     alert("No directions found");
  //   }
  // }

  displayRoute(data: any): void {
    data.routeResults.forEach((result) => {
      result.route.symbol = new SimpleLineSymbol({
        color: [5, 150, 255],
        width: 3
      });
      this.graphicsLayerRoutes.add(result.route);
    });
  
    if (data.routeResults.length > 0) {
      this.showDirections(data.routeResults[0].directions.features);
    } else {
      alert("No directions found");
    }
  }

  clearFilters() {
    if (this.view) {
      // Remove all graphics related to Filters
      if(this.graphicsLayer)
      {
        this.graphicsLayer.graphics.forEach((graphic) => {
          graphic.visible = true;
        });
      }

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox: HTMLInputElement) => {
        checkbox.checked = false;
      });

      console.log("All filters cleared and checkboxes reset.");
    }
  }

  showDirections(features: any[]) {
    this.directionsElement = document.createElement("ol");
    this.directionsElement.classList.add("esri-widget", "esri-widget--panel", "esri-directions__scroller");
    this.directionsElement.style.marginTop = "0";
    this.directionsElement.style.padding = "15px 15px 15px 30px";

    features.forEach((result, i) => {
      const direction = document.createElement("li");
      direction.innerHTML = `${result.attributes.text} (${result.attributes.length} miles)`;
      this.directionsElement.appendChild(direction);
    });

    this.view.ui.empty("top-right");
    this.view.ui.add(this.directionsElement, "top-right");
  }

  connectFirebase() {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;
    this.fbs.connectToDatabase();
    
    // Note: Removed subscriptions to list/obj that caused permission errors
    // Only using puncteColectare for recycling points
    console.log('Connected to Firebase - using puncteColectare for recycling points');
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
    if (this.view) {
      this.view.container = null;
    }

    this.disconnectFirebase();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  goToHome() {
    this.router.navigate(['/home']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  goToProfile() {
    this.router.navigate(['/profile']);
  }

  showReportDialog(locationId: string, locationName: string, lat: number, long: number): void {
    if (!this.currentUser) {
      alert('Trebuie să fii autentificat pentru a raporta o problemă!');
      return;
    }

    const message = prompt('Descrie problema (ex: "Reciclatorul nu funcționează astăzi"):');
    
    if (message && message.trim()) {
      const report: IReport = {
        locationId: locationId,
        locationName: locationName,
        message: message.trim(),
        userEmail: this.currentUser.email,
        userName: this.currentUser.username || this.currentUser.email.split('@')[0],
        timestamp: Date.now(),
        latitude: lat,
        longitude: long
      };

      this.fbs.addReport(report).then(async () => {
        alert('Raportul a fost trimis cu succes! +35 XP (15 XP report + 20 XP visit)');
        
        // Award XP for submitting report
        await this.authService.addXP(
          this.currentUser.email, 
          15, 
          'report', 
          `Report at ${locationName}`
        );

        // Award XP for visiting location
        await this.authService.addXP(
          this.currentUser.email, 
          20, 
          'visit', 
          `Visited ${locationName}`
        );

        // Update total reports and visits count
        await this.authService.incrementTotalReports(this.currentUser.email);
        await this.authService.incrementTotalVisits(this.currentUser.email);
        
        // Refresh the popup to show new report
        if (this.view && this.view.popup) {
          this.view.popup.close();
          setTimeout(() => {
            this.view.popup.open({
              location: new Point({ latitude: lat, longitude: long })
            });
          }, 300);
        }
      }).catch(error => {
        console.error('Error submitting report:', error);
        alert('Eroare la trimiterea raportului. Încearcă din nou.');
      });
    }
  }

  deleteReport(reportId: string): void {
    if (confirm('Sigur vrei să ștergi acest raport?')) {
      this.fbs.deleteReport(reportId).then(() => {
        alert('Raportul a fost șters!');
        // Refresh popup
        if (this.view && this.view.popup) {
          const location = this.view.popup.location;
          this.view.popup.close();
          setTimeout(() => {
            this.view.popup.open({ location: location });
          }, 300);
        }
      }).catch(error => {
        console.error('Error deleting report:', error);
        alert('Eroare la ștergerea raportului.');
      });
    }
  }
}
