import { PLACES_DB } from "./data/korea-places.js";
import { TRANSIT_DB } from "./data/transit-schedules.js";
import { COMMUNITY_UGC } from "./data/community-ugc.js";
import { WEATHER_FORECAST, FLIGHT_LOCKS } from "./data/weather-outlook.js";
import { calculateCascadingSchedule } from "./services/transit-engine.js";
import { evaluateSmartSlots } from "./services/smart-slot.js";
import { MapRenderer } from "./ui/map-renderer.js";
import {
  openScheduleModal,
  openFlightsWeatherModal,
  openSmartSlotModal,
  openGooglePlacesModal
} from "./ui/modals.js";

// Global Application State
const appState = {
  activeDay: 1,
  activeTab: "places",
  photoPinsEnabled: true,
  itineraryDays: {
    1: [PLACES_DB[0], PLACES_DB[1], PLACES_DB[2]], // Day 1: Gyeongbokgung, Bukchon, Gwangjang
    2: [PLACES_DB[3], PLACES_DB[4]],                // Day 2: Seongsu, COEX
    3: [PLACES_DB[4]],                              // Day 3: Rainy contingency COEX
    4: [PLACES_DB[5]],                              // Day 4: Seongsan
    5: [PLACES_DB[6], PLACES_DB[7]]                 // Day 5: Hallasan, Club at Nine Bridges
  }
};

// Initialize Map Renderer
const map = new MapRenderer("map-svg");
const modalContainer = document.getElementById("modal-container");
const popover = document.getElementById("map-popover");

function getActiveSchedule() {
  const stops = appState.itineraryDays[appState.activeDay] || [];
  return calculateCascadingSchedule(stops, "09:15");
}

function updateApplicationUI() {
  renderDayTabs();
  const schedule = getActiveSchedule();

  // Render Visual Map and Dock
  map.photoPinsEnabled = appState.photoPinsEnabled;
  map.render(schedule, (stop, x, y) => showMapPopover(stop, x, y));
  renderDock(schedule);
  renderSidebarContent();
}

// Top Bar Day Tabs
function renderDayTabs() {
  const container = document.getElementById("day-tabs-container");
  container.innerHTML = [1, 2, 3, 4, 5].map(day => `
    <button class="day-btn px-3 py-1 rounded-xl text-xs font-semibold transition-all ${appState.activeDay === day ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}" data-day="${day}">
      Day ${day}
    </button>
  `).join("");

  container.querySelectorAll(".day-btn").forEach(btn => {
    btn.onclick = () => {
      appState.activeDay = Number(btn.dataset.day);
      updateApplicationUI();
    };
  });
}

// Bottom Situational Dock
function renderDock(schedule) {
  document.getElementById("dock-day-label").textContent = `Day ${appState.activeDay}`;
  const totalStops = schedule.length;
  const timeSpan = totalStops > 0 ? `${schedule[0].arrivalTime} – ${schedule[totalStops - 1].departureTime}` : "No Stops";
  document.getElementById("dock-metrics-label").textContent = `${totalStops} Stops | ${timeSpan}`;

  const ribbon = document.getElementById("dock-route-strip");
  ribbon.innerHTML = schedule.map((stop, idx) => `
    <div class="flex items-center gap-1.5 shrink-0">
      <div class="px-2.5 py-1 rounded-xl bg-white/95 text-slate-800 text-xs font-semibold shadow-sm border border-slate-200">
        ${idx + 1}. ${stop.name} <span class="text-[10px] text-blue-600 font-bold ml-1">${stop.arrivalTime}</span>
      </div>
      ${stop.transitSegment ? `<span class="text-xs text-slate-400 font-black">›</span>` : ""}
    </div>
  `).join("");
}

// Sidebar Tab Content
function renderSidebarContent() {
  const container = document.getElementById("sidebar-content");
  if (!container) return;

  if (appState.activeTab === "places") {
    container.innerHTML = PLACES_DB.map(p => `
      <div class="bento-card p-3 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm space-y-2">
        <div class="grid grid-cols-3 gap-1.5 h-28 rounded-xl overflow-hidden bg-slate-100 relative">
          <img src="${p.photos[0]}" class="col-span-2 h-full w-full object-cover" />
          <div class="grid grid-rows-2 gap-1.5 h-full">
            <img src="${p.photos[1]}" class="w-full h-full object-cover" />
            <img src="${p.photos[2]}" class="w-full h-full object-cover" />
          </div>
          <span class="absolute top-2 left-2 px-2 py-0.5 rounded-lg apple-glass text-[10px] font-bold text-slate-800">★ ${p.rating} (${p.reviews})</span>
        </div>
        <div class="flex items-start justify-between">
          <div>
            <h4 class="text-xs font-bold text-slate-800">${p.name}</h4>
            <p class="text-[10px] text-slate-500">${p.koreanName} • ${p.category} • ${p.duration}m</p>
          </div>
          <div class="flex items-center gap-1">
            <button class="btn-smart-slot px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold" data-id="${p.id}">✨ Smart</button>
            <button class="btn-add-place px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold" data-id="${p.id}">+ Add</button>
          </div>
        </div>
      </div>
    `).join("");

    container.querySelectorAll(".btn-add-place").forEach(b => {
      b.onclick = () => {
        const place = PLACES_DB.find(p => p.id === b.dataset.id);
        const dayStops = appState.itineraryDays[appState.activeDay];
        if (place && !dayStops.some(p => p.id === place.id)) {
          dayStops.push(place);
          updateApplicationUI();
        }
      };
    });

    container.querySelectorAll(".btn-smart-slot").forEach(b => {
      b.onclick = () => {
        const place = PLACES_DB.find(p => p.id === b.dataset.id);
        const rankings = evaluateSmartSlots(place, WEATHER_FORECAST, appState.itineraryDays);
        openSmartSlotModal(modalContainer, place, rankings, (selectedDay) => {
          appState.itineraryDays[selectedDay].push(place);
          appState.activeDay = selectedDay;
          updateApplicationUI();
        });
      };
    });
  } else if (appState.activeTab === "community") {
    container.innerHTML = COMMUNITY_UGC.map(ugc => `
      <div class="bento-card p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm space-y-2">
        <div class="h-28 rounded-xl overflow-hidden relative">
          <img src="${ugc.coverPhoto}" class="w-full h-full object-cover" />
          <span class="absolute top-2 left-2 px-2 py-0.5 rounded-lg apple-glass text-[10px] font-bold text-slate-800">${ugc.vibe}</span>
          <span class="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[10px] font-medium">${ugc.clones} Clones</span>
        </div>
        <h4 class="text-xs font-bold text-slate-800">${ugc.title}</h4>
        <p class="text-[11px] text-slate-600 leading-snug">${ugc.description}</p>
        <button class="btn-clone-ugc w-full py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm" data-id="${ugc.id}">
          Clone Full 5-Day Plan
        </button>
      </div>
    `).join("");

    container.querySelectorAll(".btn-clone-ugc").forEach(b => {
      b.onclick = () => {
        const ugc = COMMUNITY_UGC.find(u => u.id === b.dataset.id);
        const stops = ugc.stopIds.map(id => PLACES_DB.find(p => p.id === id)).filter(Boolean);
        appState.itineraryDays[appState.activeDay] = stops;
        updateApplicationUI();
      };
    });
  } else if (appState.activeTab === "transit") {
    container.innerHTML = Object.values(TRANSIT_DB).map(tr => `
      <div class="p-3.5 rounded-2xl bg-white/80 border border-slate-200 shadow-sm space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded-md text-[10px] font-bold text-white" style="background-color: ${tr.color}">${tr.badge}</span>
          <span class="text-xs font-bold text-slate-700">₩${tr.fareKRW.toLocaleString()}</span>
        </div>
        <h4 class="text-xs font-bold text-slate-800">${tr.name}</h4>
        <p class="text-[11px] text-slate-500">${tr.corridor} • ${tr.durationMinutes} mins</p>
      </div>
    `).join("");
  }
}

// On-Map Popover
function showMapPopover(stop, x, y) {
  popover.style.left = `${Math.min(window.innerWidth - 340, Math.max(20, x - 160))}px`;
  popover.style.top = `${Math.min(window.innerHeight - 300, Math.max(90, y + 20))}px`;
  popover.innerHTML = `
    <div class="space-y-2">
      <div class="h-28 rounded-xl overflow-hidden">
        <img src="${stop.photos[0]}" class="w-full h-full object-cover" />
      </div>
      <div>
        <h3 class="text-xs font-bold text-slate-900">${stop.name}</h3>
        <p class="text-[11px] text-slate-500">${stop.arrivalTime} - ${stop.departureTime} (${stop.duration} mins)</p>
      </div>
      <p class="text-[10px] text-slate-600 bg-black/5 p-2 rounded-lg">💡 ${stop.tip}</p>
      <div class="flex justify-between items-center pt-1">
        <button id="btn-remove-stop" class="text-xs text-red-600 font-semibold hover:underline">Remove Stop</button>
        <button id="btn-close-popover" class="text-xs px-3 py-1 bg-black/5 rounded-lg font-medium">Done</button>
      </div>
    </div>
  `;
  popover.classList.remove("hidden");

  popover.querySelector("#btn-close-popover").onclick = () => popover.classList.add("hidden");
  popover.querySelector("#btn-remove-stop").onclick = () => {
    appState.itineraryDays[appState.activeDay] = appState.itineraryDays[appState.activeDay].filter(p => p.id !== stop.id);
    popover.classList.add("hidden");
    updateApplicationUI();
  };
}

// Event Listeners Setup
window.addEventListener("DOMContentLoaded", () => {
  // Sidebar tab clicks
  document.querySelectorAll("#sidebar-tab-selectors .tab-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#sidebar-tab-selectors .tab-btn").forEach(b => {
        b.classList.remove("bg-white", "text-slate-800", "shadow-sm");
        b.classList.add("text-slate-500");
      });
      btn.classList.add("bg-white", "text-slate-800", "shadow-sm");
      btn.classList.remove("text-slate-500");
      appState.activeTab = btn.dataset.tab;
      renderSidebarContent();
    };
  });

  // Top Bar Modal Triggers
  document.getElementById("btn-calendar-sheet").onclick = () => {
    openScheduleModal(modalContainer, getActiveSchedule(), (stopIndex, deltaMinutes) => {
      const stops = appState.itineraryDays[appState.activeDay];
      if (stops[stopIndex]) {
        stops[stopIndex].duration = Math.max(15, (stops[stopIndex].duration || 60) + deltaMinutes);
        updateApplicationUI();
        openScheduleModal(modalContainer, getActiveSchedule());
      }
    });
  };

  document.getElementById("btn-flights-weather").onclick = () => {
    openFlightsWeatherModal(modalContainer, WEATHER_FORECAST, FLIGHT_LOCKS);
  };

  document.getElementById("btn-places-api").onclick = () => {
    openGooglePlacesModal(modalContainer, () => updateApplicationUI());
  };

  // Photo Pins Toggle
  document.getElementById("btn-toggle-photo-pins").onclick = () => {
    appState.photoPinsEnabled = !appState.photoPinsEnabled;
    document.getElementById("photo-pins-icon").textContent = appState.photoPinsEnabled ? "🖼️" : "📍";
    updateApplicationUI();
  };

  // Zoom and Map View Controls
  document.getElementById("btn-zoom-in").onclick = () => {
    map.zoom = Math.min(3, map.zoom * 1.2);
    map.updateTransform();
  };
  document.getElementById("btn-zoom-out").onclick = () => {
    map.zoom = Math.max(0.5, map.zoom / 1.2);
    map.updateTransform();
  };
  document.getElementById("btn-reset-view").onclick = () => map.resetView();

  // Sidebar Collapse Toggle
  const sidebar = document.getElementById("sidebar");
  document.getElementById("btn-toggle-sidebar").onclick = () => {
    sidebar.classList.toggle("collapsed");
    document.getElementById("sidebar-chevron").classList.toggle("rotate-180");
  };

  // Dock Minimize Toggle
  const dock = document.getElementById("dock");
  const btnMinDock = document.getElementById("btn-minimize-dock");
  btnMinDock.onclick = () => {
    const isMinimized = dock.classList.contains("translate-y-12");
    dock.classList.toggle("translate-y-12");
    btnMinDock.textContent = isMinimized ? "Minimize" : "Expand";
  };

  // Initial App Render
  updateApplicationUI();
});
