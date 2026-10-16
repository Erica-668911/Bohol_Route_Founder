// Geographic coordinates for tourist spots, in latitude and longitude.
const touristSpots = {
  A: { name: 'Chocolate Hills', location: 'Carmen', lat: 9.7987699, lon: 124.1673398 },
  B: { name: 'Danao Adventure Park', location: 'Danao', lat: 9.9578475, lon: 124.1788857 },
  C: { name: 'Philippine Tarsier Sanctuary', location: 'Corella', lat: 9.6915276, lon: 123.9525551 },
  D: { name: 'Loboc River', location: 'Loboc', lat: 9.6356891, lon: 124.0300616 },
  E: { name: 'Bilar Man-Made Forest', location: 'Bilar', lat: 9.6644278, lon: 124.0800592 },
  F: { name: 'Baclayon Church', location: 'Baclayon', lat: 9.6229536, lon: 123.9124751 },
  G: { name: 'Blood Compact Shrine', location: 'Tagbilaran City', lat: 9.6274622, lon: 123.8792041 },
  H: { name: 'Hinagdanan Cave', location: 'Dauis', lat: 9.6254616, lon: 123.8009212 },
  I: { name: 'Alona Beach', location: 'Panglao', lat: 9.5484479, lon: 123.7733915 },
  J: { name: 'Pahangog Falls', location: 'Dimiao', lat: 9.6445269, lon: 124.1592499 }
};

let liveMap = null;
let mapProvider = null;
const mapMarkers = {};
let routeLayers = [];
let mapInfoWindow = null;

const graph = {
  A: { B: 20, E: 15 },
  B: { A: 20, C: 35 },
  C: { B: 35, D: 12, G: 10 },
  D: { C: 12, E: 10, F: 8 },
  E: { A: 15, D: 10, J: 18 },
  F: { D: 8, G: 5 },
  G: { C: 10, F: 5, H: 15 },
  H: { G: 15, I: 6 },
  I: { H: 6 },
  J: { E: 18 }
};

const savedRoutesStorageKey = 'bohol-route-finder.saved-routes';
let demoProfile = null;
let toastTimeout = null;

function loadTouristSpots() {
  const start = document.getElementById('start');
  const destination = document.getElementById('destination');

  for (const id in touristSpots) {
    const optionStart = document.createElement('option');
    optionStart.value = id;
    optionStart.textContent = `${id} - ${touristSpots[id].name}`;
    start.appendChild(optionStart);

    const optionDestination = document.createElement('option');
    optionDestination.value = id;
    optionDestination.textContent = `${id} - ${touristSpots[id].name}`;
    destination.appendChild(optionDestination);
  }

  start.value = 'I';
  destination.value = 'A';
}

function drawNodes() {
  for (const id in touristSpots) {
    const spot = touristSpots[id];
    const marker = mapProvider === 'google'
      ? new google.maps.Marker({
        position: { lat: spot.lat, lng: spot.lon },
        map: liveMap,
        title: spot.name,
        label: { text: id, color: '#fff', fontWeight: '800' },
        icon: makeSpotIcon(id, 'spot')
      })
      : L.marker([spot.lat, spot.lon], {
        icon: makeSpotIcon(id, 'spot')
      }).addTo(liveMap);
    const popup = document.createElement('div');
    const title = document.createElement('strong');
    const location = document.createElement('div');
    const mapsLink = document.createElement('a');
    title.textContent = spot.name;
    location.textContent = `${spot.location}, Bohol`;
    mapsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${spot.name}, ${spot.location}, Bohol, Philippines`
    )}`;
    mapsLink.target = '_blank';
    mapsLink.rel = 'noopener noreferrer';
    mapsLink.textContent = 'Open in Google Maps';
    popup.append(title, location, mapsLink);
    const openPopup = () => {
      if (mapProvider === 'google') {
        mapInfoWindow.setContent(popup);
        mapInfoWindow.open({ map: liveMap, anchor: marker });
      } else {
        marker.bindPopup(popup).openPopup();
      }
      selectStart(id);
    };
    if (mapProvider === 'google') marker.addListener('click', openPopup);
    else {
      marker.bindTooltip(spot.name, { direction: 'top', offset: [0, -12] });
      marker.on('click', openPopup);
    }
    mapMarkers[id] = marker;
  }
}

function selectStart(id) {
  document.getElementById('start').value = id;
  document.querySelectorAll('.spot-chip').forEach((chip) => {
    chip.classList.toggle('selected', chip.querySelector('span').textContent === id);
  });
  document.getElementById('route').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function drawEdges() {
  for (const from in graph) {
    for (const to in graph[from]) {
      if (from < to) createEdge(from, to);
    }
  }
}

function createEdge(from, to) {
  const point1 = touristSpots[from];
  const point2 = touristSpots[to];
  if (mapProvider === 'google') {
    new google.maps.Polyline({
      path: [
        { lat: point1.lat, lng: point1.lon },
        { lat: point2.lat, lng: point2.lon }
      ],
      geodesic: true,
      strokeColor: '#3178c6',
      strokeOpacity: 0.75,
      strokeWeight: 3,
      map: liveMap
    });
  } else {
    L.polyline(
      [[point1.lat, point1.lon], [point2.lat, point2.lon]],
      { color: '#3178c6', weight: 3, opacity: 0.75 }
    ).addTo(liveMap);
  }
}

function makeSpotIcon(id, state) {
  if (mapProvider === 'leaflet') {
    return L.divIcon({
      className: `spot-marker spot-marker-${state}`,
      html: `<span>${id}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
  }

  const colors = {
    spot: '#dc2626',
    route: '#16885b',
    start: '#2563eb',
    destination: '#9333ea'
  };
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 16,
    fillColor: colors[state],
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 3
  };
}

function initGoogleMap() {
  const mapElement = document.getElementById('map');
  if (!window.google || !window.google.maps) {
    mapElement.textContent = 'Google Maps did not load. Check the API key and internet connection, then refresh the page.';
    console.error('Google Maps JavaScript API loaded without the expected maps library.');
    return;
  }

  liveMap = new google.maps.Map(mapElement, {
    center: { lat: 9.72, lng: 124.02 },
    zoom: 10,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    scrollwheel: false
  });
  mapProvider = 'google';
  mapInfoWindow = new google.maps.InfoWindow();
  drawNodes();
  drawEdges();
  fitMapToSpots();
  findShortestRoute();
}

function fitMapToSpots() {
  if (!liveMap) return;

  if (mapProvider === 'leaflet') {
    const coordinates = Object.values(touristSpots).map((spot) => [spot.lat, spot.lon]);
    liveMap.fitBounds(coordinates, { padding: [30, 30], maxZoom: 10 });
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  Object.values(touristSpots).forEach((spot) => {
    bounds.extend({ lat: spot.lat, lng: spot.lon });
  });
  liveMap.fitBounds(bounds, 30);
}

function loadGoogleMaps() {
  const mapElement = document.getElementById('map');
  const apiKey = window.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    loadLeafletFallback();
    return;
  }

  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=initGoogleMap&loading=async`;
  script.async = true;
  script.onerror = () => {
    mapElement.textContent = 'Google Maps could not load. Check your API key and internet connection, then refresh the page.';
    console.error('Failed to load the Google Maps JavaScript API.');
  };
  document.head.appendChild(script);
}

function loadLeafletFallback() {
  const mapElement = document.getElementById('map');
  const leafletCss = document.createElement('link');
  leafletCss.rel = 'stylesheet';
  leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  leafletCss.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  leafletCss.crossOrigin = '';
  document.head.appendChild(leafletCss);

  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
  script.crossOrigin = '';
  script.onload = initializeLeafletFallback;
  script.onerror = () => {
    mapElement.textContent = 'The fallback map could not load. Check your internet connection and refresh the page.';
    console.error('Failed to load Leaflet for the OpenStreetMap fallback.');
  };
  document.head.appendChild(script);
}

function initializeLeafletFallback() {
  const mapElement = document.getElementById('map');
  if (!window.L) {
    mapElement.textContent = 'The fallback map could not load. Check your internet connection and refresh the page.';
    console.error('Leaflet loaded without the expected map library.');
    return;
  }

  mapProvider = 'leaflet';
  liveMap = L.map(mapElement, { scrollWheelZoom: false }).setView([9.72, 124.02], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
  }).addTo(liveMap);
  liveMap.on('focus', () => liveMap.scrollWheelZoom.enable());
  liveMap.on('blur', () => liveMap.scrollWheelZoom.disable());
  drawNodes();
  drawEdges();
  fitMapToSpots();
  findShortestRoute();
}

function dijkstra(start, destination) {
  const distances = {};
  const previous = {};
  const visited = {};

  for (const vertex in touristSpots) {
    distances[vertex] = Infinity;
    previous[vertex] = null;
    visited[vertex] = false;
  }

  distances[start] = 0;

  for (let count = 0; count < Object.keys(touristSpots).length; count++) {
    let current = null;
    let smallest = Infinity;

    for (const vertex in distances) {
      if (!visited[vertex] && distances[vertex] < smallest) {
        smallest = distances[vertex];
        current = vertex;
      }
    }

    if (current === null) break;

    visited[current] = true;

    for (const neighbor in graph[current]) {
      const weight = graph[current][neighbor];
      const newDistance = distances[current] + weight;
      if (newDistance < distances[neighbor]) {
        distances[neighbor] = newDistance;
        previous[neighbor] = current;
      }
    }
  }

  const path = [];
  let current = destination;

  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }

  if (path.length === 0 || path[0] !== start) {
    return null;
  }

  return { path, distance: distances[destination] };
}

function findShortestRoute() {
  const start = document.getElementById('start').value;
  const destination = document.getElementById('destination').value;
  const result = document.getElementById('routeResult');
  delete result.dataset.start;
  delete result.dataset.destination;

  if (start === destination) {
    result.style.display = 'block';
    result.innerHTML = '<h3>⚠️ Invalid Selection</h3><p>Starting point and destination must be different.</p>';
    return;
  }

  const shortest = dijkstra(start, destination);

  if (shortest === null) {
    result.style.display = 'block';
    result.innerHTML = '<h3>❌ No Route Found</h3><p>There is no available connection between the selected tourist spots.</p>';
    return;
  }

  highlightRoute(shortest.path, start, destination);

  let routeHTML = '<h3>✅ Shortest Route Found</h3><ul class="route-list">';

  shortest.path.forEach((node, index) => {
    routeHTML += `
      <li>
        <strong>${node}</strong> - ${touristSpots[node].name}<br>
        <small>${touristSpots[node].location}</small>
      </li>
    `;

    if (index < shortest.path.length - 1) {
      routeHTML += '<div class="route-arrow">↓</div>';
    }
  });

  const startSpot = touristSpots[start];
  const destinationSpot = touristSpots[destination];
  result.dataset.start = start;
  result.dataset.destination = destination;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startSpot.lat},${startSpot.lon}&destination=${destinationSpot.lat},${destinationSpot.lon}&travelmode=driving`;
  routeHTML += `
    </ul>
    <div class="total-distance">📏 Prototype graph distance: ${shortest.distance} km</div>
    <p class="route-note">The project graph uses sample distances. Open Google Maps for current road directions and travel distance.</p>
    <div class="route-actions">
      <button class="primary-btn" type="button" data-action="save-route">Save this route</button>
    </div>
    <a class="maps-directions" href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer">Get driving directions in Google Maps ↗</a>
  `;

  result.innerHTML = routeHTML;
  result.style.display = 'block';
}

function highlightRoute(path, start, destination) {
  if (!liveMap) return;

  Object.keys(touristSpots).forEach((id) => {
    mapMarkers[id].setIcon(makeSpotIcon(id, 'spot'));
  });
  routeLayers.forEach((layer) => {
    if (mapProvider === 'google') layer.setMap(null);
    else liveMap.removeLayer(layer);
  });
  routeLayers = [];

  path.forEach((id) => {
    if (id !== start && id !== destination) {
      mapMarkers[id].setIcon(makeSpotIcon(id, 'route'));
    }
  });
  mapMarkers[start].setIcon(makeSpotIcon(start, 'start'));
  mapMarkers[destination].setIcon(makeSpotIcon(destination, 'destination'));

  const routeCoordinates = path.map((id) => ({
    lat: touristSpots[id].lat,
    lng: touristSpots[id].lon
  }));
  if (mapProvider === 'google') {
    routeLayers.push(new google.maps.Polyline({
      path: routeCoordinates,
      strokeColor: '#16885b',
      strokeOpacity: 0.95,
      strokeWeight: 6,
      map: liveMap
    }));
  } else {
    routeLayers.push(L.polyline(
      routeCoordinates.map((coordinate) => [coordinate.lat, coordinate.lng]),
      { color: '#16885b', weight: 6, opacity: 0.95 }
    ).addTo(liveMap));
  }
}

function resetRoute() {
  if (liveMap) {
    Object.keys(touristSpots).forEach((id) => {
      mapMarkers[id].setIcon(makeSpotIcon(id, 'spot'));
    });
    routeLayers.forEach((layer) => {
      if (mapProvider === 'google') layer.setMap(null);
      else liveMap.removeLayer(layer);
    });
    routeLayers = [];
    fitMapToSpots();
  }

  document.getElementById('routeResult').style.display = 'none';
  delete document.getElementById('routeResult').dataset.start;
  delete document.getElementById('routeResult').dataset.destination;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 3200);
}

function isSavedRoute(value) {
  return value
    && typeof value.id === 'string'
    && typeof value.start === 'string'
    && Object.hasOwn(touristSpots, value.start)
    && typeof value.destination === 'string'
    && Object.hasOwn(touristSpots, value.destination)
    && Array.isArray(value.path)
    && value.path.length > 1
    && value.path.every((id) => typeof id === 'string' && Object.hasOwn(touristSpots, id))
    && Number.isFinite(value.distance);
}

function readSavedRoutes() {
  try {
    const storedRoutes = localStorage.getItem(savedRoutesStorageKey);
    if (storedRoutes === null) return [];

    const parsedRoutes = JSON.parse(storedRoutes);
    if (!Array.isArray(parsedRoutes)) throw new Error('Saved routes must be a list.');

    const validRoutes = parsedRoutes.filter(isSavedRoute);
    if (validRoutes.length !== parsedRoutes.length) {
      console.warn('Some saved routes contained invalid data and were skipped.');
      showToast('Some saved routes could not be loaded because their data was invalid.');
    }
    return validRoutes;
  } catch (error) {
    console.error('Could not read saved routes from this browser:', error);
    showToast('Could not load saved routes from this browser.');
    return [];
  }
}

function writeSavedRoutes(routes) {
  try {
    localStorage.setItem(savedRoutesStorageKey, JSON.stringify(routes));
    return true;
  } catch (error) {
    console.error('Could not save routes in this browser:', error);
    showToast('Could not save routes. Check browser storage settings and try again.');
    return false;
  }
}

function renderSavedRoutes(routes) {
  const list = document.getElementById('savedTripsList');
  const emptyMessage = document.getElementById('savedTripsEmpty');
  const clearButton = document.getElementById('clearSavedTripsBtn');
  list.replaceChildren();
  emptyMessage.hidden = routes.length > 0;
  clearButton.hidden = routes.length === 0;

  routes.forEach((route) => {
    const item = document.createElement('li');
    item.className = 'saved-trip';
    const details = document.createElement('div');
    details.className = 'saved-trip-details';
    const title = document.createElement('strong');
    title.textContent = `${touristSpots[route.start].name} → ${touristSpots[route.destination].name}`;
    const summary = document.createElement('small');
    summary.textContent = `${route.path.length} stops · ${route.distance} km prototype distance`;
    details.append(title, summary);

    const actions = document.createElement('div');
    actions.className = 'saved-trip-actions';
    const useButton = document.createElement('button');
    useButton.className = 'secondary-btn';
    useButton.type = 'button';
    useButton.dataset.action = 'use-route';
    useButton.dataset.routeId = route.id;
    useButton.textContent = 'Use route';
    const removeButton = document.createElement('button');
    removeButton.className = 'text-button';
    removeButton.type = 'button';
    removeButton.dataset.action = 'remove-route';
    removeButton.dataset.routeId = route.id;
    removeButton.textContent = 'Remove';
    actions.append(useButton, removeButton);
    item.append(details, actions);
    list.appendChild(item);
  });
}

function saveCurrentRoute() {
  const result = document.getElementById('routeResult');
  const start = result.dataset.start;
  const destination = result.dataset.destination;
  if (!start || !destination) {
    showToast('Find a valid route before saving it.');
    return;
  }
  const shortest = dijkstra(start, destination);
  if (!shortest) {
    showToast('Find a valid route before saving it.');
    return;
  }

  const routes = readSavedRoutes();
  if (routes.some((route) => route.start === start && route.destination === destination)) {
    showToast('This route is already in your saved routes.');
    return;
  }

  const route = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    start,
    destination,
    path: shortest.path,
    distance: shortest.distance
  };
  const updatedRoutes = [route, ...routes];
  if (!writeSavedRoutes(updatedRoutes)) return;
  renderSavedRoutes(updatedRoutes);
  showToast('Route saved on this browser.');
}

document.getElementById('routeResult').addEventListener('click', (event) => {
  if (event.target.closest('[data-action="save-route"]')) saveCurrentRoute();
});

document.getElementById('savedTripsList').addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;

  const routes = readSavedRoutes();
  const route = routes.find((savedRoute) => savedRoute.id === actionButton.dataset.routeId);
  if (!route) {
    showToast('That saved route is no longer available.');
    renderSavedRoutes(routes);
    return;
  }

  if (actionButton.dataset.action === 'use-route') {
    document.getElementById('start').value = route.start;
    document.getElementById('destination').value = route.destination;
    findShortestRoute();
    document.getElementById('route').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Saved route loaded into the planner.');
  } else if (actionButton.dataset.action === 'remove-route') {
    const updatedRoutes = routes.filter((savedRoute) => savedRoute.id !== route.id);
    if (writeSavedRoutes(updatedRoutes)) {
      renderSavedRoutes(updatedRoutes);
      showToast('Saved route removed.');
    }
  }
});

document.getElementById('clearSavedTripsBtn').addEventListener('click', () => {
  if (writeSavedRoutes([])) {
    renderSavedRoutes([]);
    showToast('All saved routes were removed.');
  }
});

let authMode = 'login';
const authDialog = document.getElementById('authDialog');
const authForm = document.getElementById('authForm');
const authName = document.getElementById('authName');
const authPassword = document.getElementById('authPassword');

function setAuthMode(mode) {
  authMode = mode;
  const isSignup = mode === 'signup';
  document.getElementById('authNameGroup').hidden = !isSignup;
  authName.required = isSignup;
  document.getElementById('authTitle').textContent = isSignup ? 'Create a profile' : 'Welcome back';
  document.getElementById('authDescription').textContent = isSignup
    ? 'Create a temporary profile to preview the sign-up experience.'
    : 'Log in to preview a personalized traveler profile.';
  document.getElementById('authSubmitBtn').textContent = isSignup ? 'Create demo profile' : 'Log in';
  document.getElementById('loginTab').classList.toggle('active', !isSignup);
  document.getElementById('signupTab').classList.toggle('active', isSignup);
  document.getElementById('loginTab').setAttribute('aria-selected', String(!isSignup));
  document.getElementById('signupTab').setAttribute('aria-selected', String(isSignup));
  authPassword.autocomplete = isSignup ? 'new-password' : 'current-password';
  document.getElementById('authFeedback').textContent = '';
}

document.getElementById('authButton').addEventListener('click', () => {
  if (demoProfile) {
    demoProfile = null;
    document.getElementById('authButton').textContent = 'Log in';
    document.getElementById('authButton').removeAttribute('aria-label');
    showToast('Demo profile signed out.');
    return;
  }
  authDialog.showModal();
  document.getElementById('authEmail').focus();
});

document.getElementById('closeAuthDialog').addEventListener('click', () => authDialog.close());
document.getElementById('loginTab').addEventListener('click', () => setAuthMode('login'));
document.getElementById('signupTab').addEventListener('click', () => setAuthMode('signup'));
document.getElementById('togglePasswordBtn').addEventListener('click', (event) => {
  const visible = authPassword.type === 'password';
  authPassword.type = visible ? 'text' : 'password';
  event.currentTarget.textContent = visible ? 'Hide' : 'Show';
  event.currentTarget.setAttribute('aria-pressed', String(visible));
});
authDialog.addEventListener('click', (event) => {
  if (event.target === authDialog) authDialog.close();
});
authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!authForm.reportValidity()) return;

  const email = document.getElementById('authEmail').value.trim();
  const name = authMode === 'signup'
    ? authName.value.trim()
    : (authName.value.trim() || email.split('@')[0]);
  if (!name) {
    document.getElementById('authFeedback').textContent = 'Please enter your name.';
    authName.focus();
    return;
  }

  demoProfile = { name, email };
  authPassword.value = '';
  document.getElementById('authButton').textContent = `Hi, ${name}`;
  document.getElementById('authButton').setAttribute('aria-label', `Signed in as ${name}. Select to log out.`);
  authDialog.close();
  authForm.reset();
  setAuthMode('login');
  document.getElementById('togglePasswordBtn').textContent = 'Show';
  document.getElementById('togglePasswordBtn').setAttribute('aria-pressed', 'false');
  showToast(`Demo profile ready for ${name}. This is not a verified account.`);
});

const sampleDataset = `Bohol is a beautiful island province in the Philippines. Visitors explore the Chocolate Hills in Carmen, the Philippine Tarsier Sanctuary in Corella, and the Loboc River. The Bilar Man-Made Forest offers a cool stop along the route to Chocolate Hills. Travelers also visit Baclayon Church, the Blood Compact Shrine, Hinagdanan Cave, Alona Beach, Danao Adventure Park, and Pahangog Falls. Bohol's beaches, rivers, caves, forests, and heritage sites make every visit memorable.`;

function getDatasetText() {
  return document.getElementById('textInput').value;
}

function getWordCount(text) {
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || []).length;
}

function utf8ByteLength(text) {
  return new TextEncoder().encode(text).length;
}

function updateDatasetStats(message) {
  const text = getDatasetText();
  document.getElementById('datasetStats').textContent =
    `${[...text].length.toLocaleString()} characters · ${getWordCount(text).toLocaleString()} words`;
  if (message !== undefined) {
    document.getElementById('datasetMessage').textContent = message;
  } else if (!text.trim()) {
    document.getElementById('datasetMessage').textContent = 'The dataset is empty. Enter text, load the sample, or upload a .txt file.';
  } else {
    document.getElementById('datasetMessage').textContent = 'Dataset ready. Search and compression use this text.';
  }
}

function clearDatasetOutputs() {
  document.getElementById('patternResult').textContent = 'Enter a pattern to compare all four algorithms.';
  document.getElementById('compressionResult').textContent = 'Select a method and compress the shared dataset.';
  document.getElementById('originalTextOutput').value = '';
  document.getElementById('compressedTextOutput').value = '';
  document.getElementById('optimizationResult').textContent = 'Run the knapsack optimizer on the shared dataset.';
  document.getElementById('randomSampleResult').textContent = 'No randomized sample run yet.';
}

function loadSampleText() {
  document.getElementById('textInput').value = sampleDataset;
  document.getElementById('patternInput').value = 'Chocolate Hills';
  document.getElementById('datasetFile').value = '';
  clearDatasetOutputs();
  updateDatasetStats('Bohol tourist-destination sample loaded.');
}

function clearDataset() {
  document.getElementById('textInput').value = '';
  document.getElementById('datasetFile').value = '';
  clearDatasetOutputs();
  updateDatasetStats();
}

async function loadDatasetFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt')) {
    updateDatasetStats('Please choose a plain-text .txt file.');
    return;
  }
  document.getElementById('textInput').value = await file.text();
  clearDatasetOutputs();
  updateDatasetStats(getDatasetText().trim() ? `Loaded ${file.name}.` : undefined);
}

function buildPrefixTable(pattern) {
  const table = new Array(pattern.length).fill(0);
  let j = 0;
  for (let i = 1; i < pattern.length; i++) {
    while (j > 0 && pattern[i] !== pattern[j]) {
      j = table[j - 1];
    }
    if (pattern[i] === pattern[j]) {
      j++;
    }
    table[i] = j;
  }
  return table;
}

function bruteForceMatch(text, pattern) {
  const matches = [];
  if (!pattern) return matches;
  for (let i = 0; i <= text.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (text[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) matches.push(i);
  }
  return matches;
}

function kmpMatch(text, pattern) {
  const matches = [];
  if (!pattern) return matches;
  const prefix = buildPrefixTable(pattern);
  let j = 0;
  for (let i = 0; i < text.length; i++) {
    while (j > 0 && text[i] !== pattern[j]) {
      j = prefix[j - 1];
    }
    if (text[i] === pattern[j]) {
      j++;
    }
    if (j === pattern.length) {
      matches.push(i - pattern.length + 1);
      j = prefix[j - 1] || 0;
    }
  }
  return matches;
}

function rabinKarpMatch(text, pattern) {
  const matches = [];
  if (!pattern || pattern.length > text.length) return matches;
  const base = 256;
  const mod = 1000000007;
  let patternHash = 0;
  let windowHash = 0;
  let highestPower = 1;

  for (let i = 0; i < pattern.length; i++) {
    patternHash = (patternHash * base + pattern.charCodeAt(i)) % mod;
    windowHash = (windowHash * base + text.charCodeAt(i)) % mod;
    if (i < pattern.length - 1) highestPower = (highestPower * base) % mod;
  }

  for (let i = 0; i <= text.length - pattern.length; i++) {
    if (windowHash === patternHash && text.slice(i, i + pattern.length) === pattern) {
      matches.push(i);
    }

    if (i + pattern.length < text.length) {
      const outgoingHash = (text.charCodeAt(i) * highestPower) % mod;
      windowHash = (windowHash - outgoingHash + mod) % mod;
      windowHash = (windowHash * base + text.charCodeAt(i + pattern.length)) % mod;
    }
  }

  return matches;
}

function boyerMooreMatch(text, pattern) {
  const matches = [];
  if (!pattern) return matches;
  const badChar = new Map();
  for (let i = 0; i < pattern.length; i++) {
    badChar.set(pattern[i], i);
  }

  let shift = 0;
  while (shift <= text.length - pattern.length) {
    let j = pattern.length - 1;
    while (j >= 0 && text[shift + j] === pattern[j]) {
      j--;
    }
    if (j < 0) {
      matches.push(shift);
      shift += (shift + pattern.length < text.length) ? pattern.length - (badChar.get(text[shift + pattern.length]) ?? -1) : 1;
    } else {
      const badCharShift = badChar.get(text[shift + j]) ?? -1;
      shift += Math.max(1, j - badCharShift);
    }
  }

  return matches;
}

function runPatternMatch() {
  const text = getDatasetText();
  const pattern = document.getElementById('patternInput').value;
  const result = document.getElementById('patternResult');

  if (!text.trim()) {
    result.textContent = 'Cannot search: the dataset is empty.';
    updateDatasetStats();
    return;
  }
  if (!pattern.length) {
    result.textContent = 'Enter a non-empty search pattern.';
    return;
  }

  const algorithms = [
    ['Brute Force', bruteForceMatch],
    ['Knuth-Morris-Pratt (KMP)', kmpMatch],
    ['Rabin-Karp', rabinKarpMatch],
    ['Boyer-Moore (bad-character)', boyerMooreMatch]
  ];
  const lines = [`Pattern: "${pattern}"`];
  algorithms.forEach(([name, search]) => {
    const started = performance.now();
    const matches = search(text, pattern);
    const elapsed = performance.now() - started;
    const shownPositions = matches.slice(0, 100).join(', ');
    const positionText = matches.length
      ? `Positions (0-based): ${shownPositions}${matches.length > 100 ? ` … and ${matches.length - 100} more` : ''}`
      : 'No matches.';
    lines.push(`${name}: ${matches.length} occurrence(s) · ${elapsed.toFixed(4)} ms\n${positionText}`);
  });
  result.textContent = lines.join('\n\n');
}

function runLengthEncode(text) {
  const runs = [];
  for (const character of text) {
    const previousRun = runs[runs.length - 1];
    if (previousRun && previousRun[0] === character) {
      previousRun[1]++;
    } else {
      runs.push([character, 1]);
    }
  }
  return JSON.stringify(runs);
}

function optimizeDictionary(text, budget) {
  const wordCounts = new Map();
  const wordPattern = /[A-Za-z0-9]+/g;
  for (const match of text.matchAll(wordPattern)) {
    const word = match[0];
    const item = wordCounts.get(word) || { count: 0 };
    item.count++;
    wordCounts.set(word, item);
  }

  const candidates = [...wordCounts.entries()]
    .filter(([, item]) => item.count > 1)
    .sort((a, b) => b[1].count * b[0].length - a[1].count * a[0].length);
  const items = candidates.map(([word, item], index) => {
    const code = String(index);
    const weight = utf8ByteLength(JSON.stringify([code, word])) + 1;
    const saving = item.count * (word.length - code.length);
    return { word, code, weight, saving };
  }).filter((item) => item.weight > 0 && item.weight < budget && item.saving > 0);

  const itemBudget = Math.max(0, budget - 1);
  const bestByWeight = new Map([[0, { saving: 0, previous: null, item: null }]]);
  for (const item of items) {
    const previousStates = [...bestByWeight.entries()];
    for (const [weight, state] of previousStates) {
      const nextWeight = weight + item.weight;
      if (nextWeight > itemBudget) continue;
      const nextSaving = state.saving + item.saving;
      if (!bestByWeight.has(nextWeight) || bestByWeight.get(nextWeight).saving < nextSaving) {
        bestByWeight.set(nextWeight, { saving: nextSaving, previous: state, item });
      }
    }
  }

  let bestState = { saving: 0, previous: null, item: null };
  let usedBudget = 0;
  for (const [weight, state] of bestByWeight) {
    if (state.saving > bestState.saving) {
      bestState = state;
      usedBudget = weight;
    }
  }

  const dictionaryEntries = [];
  for (let state = bestState; state && state.item; state = state.previous) {
    dictionaryEntries.push([state.item.code, state.item.word]);
  }
  dictionaryEntries.reverse();
  const codeByWord = new Map(dictionaryEntries.map(([code, word]) => [word, code]));
  const tokens = [];
  let cursor = 0;
  for (const match of text.matchAll(wordPattern)) {
    if (match.index > cursor) tokens.push({ text: text.slice(cursor, match.index) });
    const code = codeByWord.get(match[0]);
    tokens.push(code === undefined ? { text: match[0] } : { ref: code });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) tokens.push({ text: text.slice(cursor) });
  const payload = JSON.stringify({ dictionary: dictionaryEntries, tokens });
  return {
    payload,
    dictionaryEntries,
    usedBudget: dictionaryEntries.length ? usedBudget + 1 : 2,
    estimatedSaving: bestState.saving
  };
}

function runCompression() {
  const text = getDatasetText();
  const method = document.getElementById('compressionAlgorithm').value;
  const result = document.getElementById('compressionResult');
  if (!text.trim()) {
    result.textContent = 'Cannot compress: the dataset is empty.';
    updateDatasetStats();
    return;
  }

  const started = performance.now();
  let compressed;
  let methodName;
  if (method === 'rle') {
    compressed = runLengthEncode(text);
    methodName = 'Run-Length Encoding';
  } else {
    const budget = Number(document.getElementById('dictionaryBudget').value);
    if (!Number.isInteger(budget) || budget < 2 || budget > 5000) {
      result.textContent = 'Dictionary budget must be a whole number from 2 to 5000 bytes.';
      return;
    }
    compressed = optimizeDictionary(text, budget).payload;
    methodName = 'Dictionary-Based Compression';
  }
  const elapsed = performance.now() - started;
  const originalBytes = utf8ByteLength(text);
  const compressedBytes = utf8ByteLength(compressed);
  const ratio = originalBytes === 0 ? 0 : compressedBytes / originalBytes;
  const sizeMessage = compressedBytes < originalBytes
    ? `Encoded output is ${originalBytes - compressedBytes} bytes smaller.`
    : compressedBytes > originalBytes
      ? `Encoded output is ${compressedBytes - originalBytes} bytes larger; this method did not reduce the size.`
      : 'Encoded output has the same size as the original.';

  document.getElementById('originalTextOutput').value = text;
  document.getElementById('compressedTextOutput').value = compressed;
  result.textContent = [
    `Method: ${methodName}`,
    `Original size: ${originalBytes} UTF-8 bytes`,
    `Compressed representation: ${compressedBytes} UTF-8 bytes`,
    `Compression ratio (compressed ÷ original): ${ratio.toFixed(3)} (${(ratio * 100).toFixed(1)}%)`,
    sizeMessage,
    `Execution time: ${elapsed.toFixed(4)} ms`
  ].join('\n');
}

function caesarCipher(text, shift) {
  return Array.from(text, (character) => {
    const code = character.charCodeAt(0);
    const base = code >= 65 && code <= 90 ? 65 : code >= 97 && code <= 122 ? 97 : null;
    if (base === null) return character;
    return String.fromCharCode(((code - base + shift) % 26 + 26) % 26 + base);
  }).join('');
}

function runCaesarCipher(mode) {
  const text = document.getElementById('caesarInput').value;
  const shift = Number(document.getElementById('caesarShift').value);
  const status = document.getElementById('caesarStatus');

  if (!Number.isInteger(shift) || shift < 0 || shift > 25) {
    status.textContent = 'Enter a whole-number shift from 0 to 25.';
    return;
  }

  const effectiveShift = mode === 'encrypt' ? shift : (26 - shift) % 26;
  document.getElementById('caesarOutput').value = caesarCipher(text, effectiveShift);
  status.textContent = mode === 'encrypt' ? 'Message encrypted.' : 'Message decrypted.';
}

document.getElementById('caesarEncryptBtn').addEventListener('click', () => {
  runCaesarCipher('encrypt');
});
document.getElementById('caesarDecryptBtn').addEventListener('click', () => {
  runCaesarCipher('decrypt');
});

document.getElementById('textInput').addEventListener('input', () => updateDatasetStats());
document.getElementById('loadSampleBtn').addEventListener('click', loadSampleText);
document.getElementById('clearDatasetBtn').addEventListener('click', clearDataset);
document.getElementById('datasetFile').addEventListener('change', (event) => {
  loadDatasetFile(event.target.files[0]).catch((error) => {
    console.error('Could not load the selected text file:', error);
    updateDatasetStats('Could not read that file. Please choose another .txt file.');
  });
});
document.getElementById('searchPatternBtn').addEventListener('click', runPatternMatch);
document.getElementById('compressDatasetBtn').addEventListener('click', runCompression);
document.getElementById('optimizeDatasetBtn').addEventListener('click', runOptimization);
document.getElementById('randomSampleBtn').addEventListener('click', runRandomizedSample);

function runOptimization() {
  const text = getDatasetText();
  const result = document.getElementById('optimizationResult');
  const budget = Number(document.getElementById('dictionaryBudget').value);
  if (!text.trim()) {
    result.textContent = 'Cannot optimize: the dataset is empty.';
    updateDatasetStats();
    return;
  }
  if (!Number.isInteger(budget) || budget < 2 || budget > 5000) {
    result.textContent = 'Dictionary budget must be a whole number from 2 to 5000 bytes.';
    return;
  }

  const started = performance.now();
  const optimized = optimizeDictionary(text, budget);
  const elapsed = performance.now() - started;
  const payloadSize = utf8ByteLength(optimized.payload);
  const originalSize = utf8ByteLength(text);
  result.textContent = [
    'Exact 0/1 knapsack optimization of dictionary entries',
    `Selected entries: ${optimized.dictionaryEntries.length}`,
    `Dictionary storage used: ${optimized.usedBudget} / ${budget} UTF-8 bytes (includes JSON array punctuation)`,
    `Estimated encoded-text savings: ${optimized.estimatedSaving} characters`,
    `Resulting representation: ${payloadSize} UTF-8 bytes vs ${originalSize} original bytes`,
    payloadSize < originalSize ? 'The optimized representation is smaller.' : 'The optimized representation is not smaller for this dataset.',
    `Execution time: ${elapsed.toFixed(4)} ms`,
    optimized.dictionaryEntries.length
      ? `Selected dictionary: ${optimized.dictionaryEntries.map(([code, word]) => `${code} = ${word}`).join(', ')}`
      : 'No repeated words fit the budget with a positive estimated saving.'
  ].join('\n');
}

function runRandomizedSample() {
  const text = getDatasetText();
  const result = document.getElementById('randomSampleResult');
  const words = text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];
  const requestedSize = Number(document.getElementById('sampleSize').value);
  if (!text.trim()) {
    result.textContent = 'Cannot sample: the dataset is empty.';
    updateDatasetStats();
    return;
  }
  if (!Number.isInteger(requestedSize) || requestedSize < 1 || requestedSize > 1000) {
    result.textContent = 'Sample size must be a whole number from 1 to 1000.';
    return;
  }
  const started = performance.now();
  const sample = [];
  words.forEach((word, index) => {
    if (index < requestedSize) {
      sample.push(word);
    } else {
      const replacementIndex = Math.floor(Math.random() * (index + 1));
      if (replacementIndex < requestedSize) sample[replacementIndex] = word;
    }
  });
  const elapsed = performance.now() - started;
  result.textContent = `Reservoir sample: ${sample.length} of ${words.length} words\n${sample.join(', ') || 'No words found.'}\nExecution time: ${elapsed.toFixed(4)} ms`;
}

function toggleFullscreen() {
  const mapBox = document.querySelector('.map-wrapper');
  if (!document.fullscreenElement) {
    mapBox.requestFullscreen().catch((error) => {
      console.error('Could not enter map full screen:', error);
    });
  } else {
    document.exitFullscreen();
  }
}

document.getElementById('fullScreenBtn').addEventListener('click', toggleFullscreen);

document.addEventListener('fullscreenchange', function () {
  const wrapper = document.querySelector('.map-wrapper');
  const map = document.querySelector('.map');
  if (document.fullscreenElement) {
    wrapper.style.height = '100vh';
    wrapper.style.borderRadius = '0';
    map.style.height = '100vh';
    map.style.minWidth = '0';
  } else {
    wrapper.style.height = '';
    wrapper.style.borderRadius = '';
    map.style.height = '';
    map.style.minWidth = '';
  }
  if (liveMap && mapProvider === 'google') {
    setTimeout(() => google.maps.event.trigger(liveMap, 'resize'), 100);
  } else if (liveMap) {
    setTimeout(() => liveMap.invalidateSize(), 100);
  }
});

window.onload = function () {
  updateDatasetStats();
  loadTouristSpots();
  renderSavedRoutes(readSavedRoutes());
  loadGoogleMaps();
  findShortestRoute();
};

window.addEventListener('resize', function () {
  if (liveMap && mapProvider === 'google') google.maps.event.trigger(liveMap, 'resize');
  else if (liveMap) liveMap.invalidateSize();
});
