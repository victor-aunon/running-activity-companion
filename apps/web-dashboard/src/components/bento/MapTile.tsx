'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Map, Layers, Target, TrendingUp, Plus, Minus, Compass } from 'lucide-react';
import { formatElapsedTime } from './HeaderTile';

export interface MapTileProps {
  currentLat?: number;
  currentLng?: number;
  gpsQuality?: number;
  pathCoordinates?: [number, number][];
  elapsedSeconds?: number;
  elevationM?: number;
  eta?: string;
  routeName?: string;
  elevationProfileText?: string;
}

interface LeafletInitParams {
  container: HTMLDivElement;
  lat: number;
  lng: number;
  path: [number, number][];
  onUserInteraction: () => void;
}

function initLeafletMap(L: any, params: LeafletInitParams) {
  const map = L.map(params.container, { zoomControl: false, attributionControl: false }).setView(
    [params.lat, params.lng],
    16,
  );

  map.on('dragstart', () => {
    params.onUserInteraction();
  });

  const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  });
  const satelliteLayer = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 19 },
  );
  streetLayer.addTo(map);

  const runnerIcon = L.divIcon({
    className: 'custom-runner-icon',
    html: '<div style="width: 22px; height: 22px; background: #ea580c; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 14px rgba(234, 88, 12, 0.9);"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  const marker = L.marker([params.lat, params.lng], { icon: runnerIcon }).addTo(map);
  const polyline = L.polyline(params.path, {
    color: '#ea580c',
    weight: 5,
    opacity: 0.9,
    smoothFactor: 1,
  }).addTo(map);
  return { map, marker, polyline, streetLayer, satelliteLayer };
}

interface LeafletHookParams {
  containerRef: React.RefObject<HTMLDivElement | null>;
  lat: number;
  lng: number;
  path: [number, number][];
  isDegraded: boolean;
  isFollowing: boolean;
  onUserInteraction: () => void;
}

function switchMapLayer(map: any, streetLayer: any, satelliteLayer: any, enableSatellite: boolean) {
  if (enableSatellite) {
    if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
  } else {
    if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
  }
}

function updateLeafletEntities(
  inst: { marker: any; map: any; polyline: any } | null,
  params: LeafletHookParams,
) {
  if (!inst) return;
  inst.marker?.setLatLng([params.lat, params.lng]);
  if (!params.isDegraded) {
    inst.polyline?.setLatLngs(params.path);
  }
  if (params.isFollowing) {
    inst.map?.panTo([params.lat, params.lng], { animate: true, duration: 0.8 });
  }
}

function getMapControls(instancesRef: React.MutableRefObject<any>, params: LeafletHookParams) {
  const centerRunner = () => {
    instancesRef.current?.map?.setView([params.lat, params.lng], 16, { animate: true });
  };

  const toggleSatellite = (enableSatellite: boolean) => {
    const inst = instancesRef.current;
    if (!inst?.map) return;
    switchMapLayer(inst.map, inst.streetLayer, inst.satelliteLayer, enableSatellite);
  };

  const zoomIn = () => {
    instancesRef.current?.map?.zoomIn();
  };

  const zoomOut = () => {
    instancesRef.current?.map?.zoomOut();
  };

  return { centerRunner, toggleSatellite, zoomIn, zoomOut };
}

function useLeafletInstance(params: LeafletHookParams) {
  const instancesRef = useRef<{
    map: any;
    marker: any;
    polyline: any;
    streetLayer: any;
    satelliteLayer: any;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !params.containerRef.current) return;
    let isMounted = true;
    void import('leaflet').then((L) => {
      if (!isMounted || !params.containerRef.current || instancesRef.current) return;
      instancesRef.current = initLeafletMap(L, {
        container: params.containerRef.current,
        lat: params.lat,
        lng: params.lng,
        path: params.path,
        onUserInteraction: params.onUserInteraction,
      });
    });
    return () => {
      isMounted = false;
      instancesRef.current?.map?.remove();
      instancesRef.current = null;
    };
  }, [params.containerRef]);

  useEffect(() => {
    updateLeafletEntities(instancesRef.current, params);
  }, [params.lat, params.lng, params.path, params.isDegraded, params.isFollowing]);

  return getMapControls(instancesRef, params);
}

interface MapCardHeaderProps {
  routeName?: string;
  gpsQuality?: number;
  isSatellite: boolean;
  isFollowing: boolean;
  onToggleSatellite: () => void;
  onCenterRunner: () => void;
}

function FollowRunnerButton({
  isFollowing,
  onCenterRunner,
}: {
  isFollowing: boolean;
  onCenterRunner: () => void;
}) {
  if (isFollowing) {
    return (
      <button
        type="button"
        onClick={onCenterRunner}
        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-200"
        title="Siguiendo en vivo al corredor"
      >
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>Siguiendo</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onCenterRunner}
      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 active:scale-95 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-sm shadow-orange-200 animate-pulse"
      title="Centrar y volver a seguir al corredor"
    >
      <Target className="w-3.5 h-3.5" />
      <span>Centrar Runner</span>
    </button>
  );
}

function MapCardHeader({
  routeName,
  gpsQuality,
  isSatellite,
  isFollowing,
  onToggleSatellite,
  onCenterRunner,
}: MapCardHeaderProps) {
  const isGpsActive = gpsQuality !== undefined && gpsQuality > 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Map className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{routeName || 'Ruta GPS en Directo'}</h2>
          <p className="text-xs text-slate-400 font-medium">
            {isGpsActive ? 'Señal satelital en vivo activa' : 'Buscando cobertura satelital...'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleSatellite}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 active:scale-95 ${
            isSatellite
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
          title={isSatellite ? 'Cambiar a mapa vectorial' : 'Cambiar a vista satélite'}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isSatellite ? 'Mapa' : 'Satélite'}</span>
        </button>
        <FollowRunnerButton isFollowing={isFollowing} onCenterRunner={onCenterRunner} />
      </div>
    </div>
  );
}

function MapHudOverlay({
  elapsedSeconds,
  elevationM,
  eta,
}: {
  elapsedSeconds?: number;
  elevationM?: number;
  eta?: string;
}) {
  const elapsedText = formatElapsedTime(elapsedSeconds);
  const elevationText =
    elevationM !== undefined && isFinite(elevationM) ? `${Math.round(elevationM)} m` : '-- m';
  const etaText = eta || '--:--';

  return (
    <div className="absolute bottom-4 left-4 z-[500] bg-slate-900/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 text-white flex items-center gap-4 text-xs font-medium">
      <div>
        <span className="text-slate-400 block text-[10px]">Tiempo Transcurrido</span>
        <span className="font-bold text-sm tracking-wide font-mono">{elapsedText}</span>
      </div>
      <div className="h-6 w-px bg-slate-700" />
      <div>
        <span className="text-slate-400 block text-[10px]">Altitud</span>
        <span className="font-bold text-sm tracking-wide font-mono">{elevationText}</span>
      </div>
      <div className="h-6 w-px bg-slate-700" />
      <div>
        <span className="text-slate-400 block text-[10px]">ETA Meta</span>
        <span className="font-bold text-sm tracking-wide text-teal-400 font-mono">{etaText}</span>
      </div>
    </div>
  );
}

function MapZoomControls({
  onZoomIn,
  onZoomOut,
  onCenterRunner,
  isFollowing,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterRunner: () => void;
  isFollowing: boolean;
}) {
  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-[500]">
      <button
        type="button"
        onClick={onZoomIn}
        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm flex items-center justify-center transition-all active:scale-90"
        title="Acercar zoom"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm flex items-center justify-center transition-all active:scale-90"
        title="Alejar zoom"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onCenterRunner}
        className={`w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm flex items-center justify-center transition-all active:scale-90 ${
          !isFollowing ? 'ring-2 ring-orange-500 animate-pulse' : ''
        }`}
        title="Centrar en corredor"
      >
        <Compass className={`w-4 h-4 ${isFollowing ? 'text-emerald-600' : 'text-orange-600'}`} />
      </button>
    </div>
  );
}

function ElevationFooter({ elevationProfileText }: { elevationProfileText?: string }) {
  if (!elevationProfileText) {
    return (
      <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-slate-400" />
          <span className="font-medium">Perfil de Elevación: Esperando datos de altimetría</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-indigo-500" />
        <span className="font-semibold text-slate-700">{elevationProfileText}</span>
      </div>
    </div>
  );
}

function MapViewport({
  containerRef,
  elapsedSeconds,
  elevationM,
  eta,
  onZoomIn,
  onZoomOut,
  onCenterRunner,
  isFollowing,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  elapsedSeconds?: number;
  elevationM?: number;
  eta?: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenterRunner: () => void;
  isFollowing: boolean;
}) {
  return (
    <div className="relative w-full h-[460px] lg:flex-1 lg:min-h-[460px] rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80">
      <MapHudOverlay elapsedSeconds={elapsedSeconds} elevationM={elevationM} eta={eta} />
      <MapZoomControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onCenterRunner={onCenterRunner}
        isFollowing={isFollowing}
      />
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

function useMapTileState(
  props: MapTileProps,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [isSatellite, setIsSatellite] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);

  const controls = useLeafletInstance({
    containerRef,
    lat: props.currentLat ?? 40.4168,
    lng: props.currentLng ?? -3.7038,
    path: props.pathCoordinates ?? [],
    isDegraded: (props.gpsQuality ?? 0) === 0,
    isFollowing,
    onUserInteraction: () => setIsFollowing(false),
  });

  const handleCenterRunner = () => {
    setIsFollowing(true);
    controls.centerRunner();
  };

  const handleToggleSatellite = () => {
    const next = !isSatellite;
    setIsSatellite(next);
    controls.toggleSatellite(next);
  };

  return { isSatellite, isFollowing, controls, handleCenterRunner, handleToggleSatellite };
}

export function MapTile(props: MapTileProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const state = useMapTileState(props, mapContainerRef);

  return (
    <div className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4 flex flex-col h-full justify-between">
      <MapCardHeader
        routeName={props.routeName}
        gpsQuality={props.gpsQuality}
        isSatellite={state.isSatellite}
        isFollowing={state.isFollowing}
        onToggleSatellite={state.handleToggleSatellite}
        onCenterRunner={state.handleCenterRunner}
      />
      <MapViewport
        containerRef={mapContainerRef}
        elapsedSeconds={props.elapsedSeconds}
        elevationM={props.elevationM}
        eta={props.eta}
        onZoomIn={state.controls.zoomIn}
        onZoomOut={state.controls.zoomOut}
        onCenterRunner={state.handleCenterRunner}
        isFollowing={state.isFollowing}
      />
      <ElevationFooter elevationProfileText={props.elevationProfileText} />
    </div>
  );
}
