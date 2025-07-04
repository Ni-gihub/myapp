const API_KEY = '5b3ce3597851110001cf6248eeb653d5c2634cfbbd0b2b1ca61dab46';

let currentRouteLayer = null;
let currentStartMarker = null;
let currentDestinationMarker = null;

const map = L.map('map').setView([35.6812, 139.7671], 13);

// OpenStreetMapタイルレイヤー
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

// 赤いピンアイコン（目的地用）
const redIcon = L.icon({
  iconUrl:
    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 住所から座標を取得する関数（ジオコーディング）
async function geocodeAddress(address) {
  const geocodeUrl = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(address)}`;

  const res = await fetch(geocodeUrl);
  const json = await res.json();

  if (!json.features.length) throw new Error('位置が見つかりません: ' + address);

  const coords = json.features[0].geometry.coordinates; // [lng, lat]
  return { lat: coords[1], lng: coords[0] };
}

// ルート描画関数
async function drawRoute(start, end) {
  if (!start || !end) return;

  const url =
    'https://api.openrouteservice.org/v2/directions/driving-car/geojson?language=ja';

  const body = {
    coordinates: [
      [start.lng, start.lat],
      [end.lng, end.lat]
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error('APIエラー: ' + response.status);

    const data = await response.json();

    // 古いルート削除
    if (currentRouteLayer) map.removeLayer(currentRouteLayer);

    // ルート描画
    currentRouteLayer = L.geoJSON(data, {
      style: { color: 'red', weight: 5 }
    }).addTo(map);

    // 距離・時間表示
    const summary = data.features[0].properties.summary;
    document.getElementById('distance').textContent =
      (summary.distance / 1000).toFixed(2) + ' km';
    document.getElementById('duration').textContent =
      Math.round(summary.duration / 60) + ' 分';

    // 案内メッセージ表示
    const steps = data.features[0].properties.segments[0].steps;
    const instructionList = document.getElementById('instructions');
    instructionList.innerHTML = '';

    steps.forEach(step => {
      const li = document.createElement('li');
      li.textContent = step.instruction;
      instructionList.appendChild(li);
    });

    // 地図表示範囲調整
    const coordsArray = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const bounds = L.latLngBounds(coordsArray);
    map.fitBounds(bounds, { padding: [50, 50] });

  } catch (err) {
    alert('ルート取得エラー: ' + err.message);
  }
}

// 検索ボタンイベント
document.getElementById('search-btn').addEventListener('click', async () => {
  const startText = document.getElementById('start-input').value.trim();
  const destinationText = document.getElementById('destination-input').value.trim();

  if (!startText || !destinationText) {
    alert('スタート地点と目的地の両方を入力してください');
    return;
  }

  try {
    // 座標取得
    const startCoords = await geocodeAddress(startText);
    const destCoords = await geocodeAddress(destinationText);

    // スタートマーカー更新
    if (currentStartMarker) map.removeLayer(currentStartMarker);
    currentStartMarker = L.marker(startCoords).addTo(map).bindPopup('スタート地点').openPopup();

    // 目的地マーカー更新（赤ピン）
    if (currentDestinationMarker) map.removeLayer(currentDestinationMarker);
    currentDestinationMarker = L.marker(destCoords, { icon: redIcon })
      .addTo(map)
      .bindPopup('目的地')
      .openPopup();

    // ルート描画
    drawRoute(startCoords, destCoords);
  } catch (error) {
    alert('ジオコーディングエラー: ' + error.message);
  }
});