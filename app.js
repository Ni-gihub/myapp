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

// 座標保持用
let startCoords = null;
let destCoords = null;

// 住所から座標を取得する関数（ジオコーディング）
async function geocodeAddress(address) {
  const geocodeUrl = `https://api.openrouteservice.org/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(address)}`;

  const res = await fetch(geocodeUrl);
  const json = await res.json();

  if (!json.features.length) throw new Error('位置が見つかりません: ' + address);

  const coords = json.features[0].geometry.coordinates; // [lng, lat]
  return { lat: coords[1], lng: coords[0] };
}

// ルート描画関数（引数に座標オブジェクトを受け取る）
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

// --- 住所入力補助（サジェスト）機能 ---
// 入力欄に対してサジェストの<ul>要素を作成しDOMに追加
function setupAutocomplete(inputId) {
  const input = document.getElementById(inputId);
  const suggestions = document.createElement('ul');
  suggestions.style.position = 'absolute';
  suggestions.style.backgroundColor = '#fff';
  suggestions.style.border = '1px solid #ccc';
  suggestions.style.listStyle = 'none';
  suggestions.style.padding = '0';
  suggestions.style.margin = '0';
  suggestions.style.maxHeight = '150px';
  suggestions.style.overflowY = 'auto';
  suggestions.style.width = input.offsetWidth + 'px';
  suggestions.style.zIndex = 1000;
  suggestions.style.display = 'none';
  input.parentNode.style.position = 'relative';
  input.parentNode.appendChild(suggestions);

  let selectedCoords = null;

  input.addEventListener('input', async () => {
    const query = input.value.trim();
    if (!query) {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      selectedCoords = null;
      if (inputId === 'start-input') startCoords = null;
      else if (inputId === 'destination-input') destCoords = null;
      return;
    }

    const url = `https://api.openrouteservice.org/geocode/autocomplete?api_key=${API_KEY}&text=${encodeURIComponent(query)}&boundary.country=JP&size=5`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.features || data.features.length === 0) {
        suggestions.innerHTML = '';
        suggestions.style.display = 'none';
        selectedCoords = null;
        if (inputId === 'start-input') startCoords = null;
        else if (inputId === 'destination-input') destCoords = null;
        return;
      }

      suggestions.innerHTML = data.features.map(f =>
        `<li style="padding:5px; cursor:pointer;" data-lat="${f.geometry.coordinates[1]}" data-lng="${f.geometry.coordinates[0]}">${f.properties.label}</li>`
      ).join('');
      suggestions.style.display = 'block';

      suggestions.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => {
          input.value = li.textContent;
          selectedCoords = {
            lat: parseFloat(li.dataset.lat),
            lng: parseFloat(li.dataset.lng)
          };
          if (inputId === 'start-input') startCoords = selectedCoords;
          else if (inputId === 'destination-input') destCoords = selectedCoords;
          suggestions.style.display = 'none';
        });
      });
    } catch {
      suggestions.innerHTML = '';
      suggestions.style.display = 'none';
      selectedCoords = null;
      if (inputId === 'start-input') startCoords = null;
      else if (inputId === 'destination-input') destCoords = null;
    }
  });

  // リスト外クリックで非表示にする処理（任意）
  document.addEventListener('click', (e) => {
    if (!suggestions.contains(e.target) && e.target !== input) {
      suggestions.style.display = 'none';
    }
  });
}

// 住所入力補助をスタート地点・目的地の入力欄にセットアップ
setupAutocomplete('start-input');
setupAutocomplete('destination-input');

// 検索ボタンイベント（座標がセットされていればそれを使う）
document.getElementById('search-btn').addEventListener('click', async () => {
  try {
    let start = startCoords;
    let dest = destCoords;

    // 座標がない場合はテキストからジオコーディング
    if (!start) {
      const startText = document.getElementById('start-input').value.trim();
      if (!startText) throw new Error('スタート地点を入力してください');
      start = await geocodeAddress(startText);
    }
    if (!dest) {
      const destText = document.getElementById('destination-input').value.trim();
      if (!destText) throw new Error('目的地を入力してください');
      dest = await geocodeAddress(destText);
    }

    // マーカー更新
    if (currentStartMarker) map.removeLayer(currentStartMarker);
    currentStartMarker = L.marker(start).addTo(map).bindPopup('スタート地点').openPopup();

    if (currentDestinationMarker) map.removeLayer(currentDestinationMarker);
    currentDestinationMarker = L.marker(dest, { icon: redIcon }).addTo(map).bindPopup('目的地').openPopup();

    // ルート描画
    drawRoute(start, dest);

  } catch (error) {
    alert('エラー: ' + error.message);
  }
});

// Enterキーで検索ボタン押す
document.querySelectorAll('#start-input, #destination-input').forEach(input => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('search-btn').click();
    }
  });
});