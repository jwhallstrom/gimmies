import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { getCourseById, getAllCourses } from '../data/cloudCourses';
import { useCourses } from '../hooks/useCourses';
import useStore from '../state/store';

const PENDING_JOIN_KEY = 'gimmies.pendingJoinCode.v1';
const DEFAULT_ITEMS_LIMIT = 5;
const SECTION_ORDER_KEY = 'gimmies.joinSectionOrder.v1';
const DEFAULT_SECTION_ORDER = ['courses', 'events'];

type SectionId = 'courses' | 'events';

function getSavedSectionOrder(): SectionId[] {
  try {
    const saved = localStorage.getItem(SECTION_ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.every(id => DEFAULT_SECTION_ORDER.includes(id))) {
        return parsed as SectionId[];
      }
    }
  } catch {}
  return DEFAULT_SECTION_ORDER as SectionId[];
}

function saveSectionOrder(order: SectionId[]): void {
  try {
    localStorage.setItem(SECTION_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

function extractJoinCode(raw: string): string {
  const upper = String(raw || '').toUpperCase();
  const match = upper.match(/[A-Z0-9]{6}/);
  return match ? match[0] : '';
}

function isUpcoming(dateStr: string): boolean {
  if (!dateStr) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return true;
  d.setHours(0, 0, 0, 0);
  return d.getTime() >= today.getTime();
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const JoinEventPage: React.FC = () => {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();

  const { courses: allCoursesFromHook, loading: loadingCourses } = useCourses();

  const joinEventByCode = useStore((s: any) => s.joinEventByCode);
  const addGolferToEvent = useStore((s: any) => s.addGolferToEvent);
  const currentProfile = useStore((s: any) => s.currentProfile);
  const myEvents = useStore((s: any) => s.events);
  const addToast = useStore((s: any) => s.addToast);

  // Public events
  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Section states (collapsible)
  const [showCourses, setShowCourses] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showAllCourses, setShowAllCourses] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  
  // Section order (draggable)
  const [sectionOrder, setSectionOrder] = useState<SectionId[]>(getSavedSectionOrder);
  const [draggedSection, setDraggedSection] = useState<SectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<SectionId | null>(null);
  
  // Geo state
  const [geoStatus, setGeoStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied' | 'unsupported'>('idle');
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // FAB menu
  const [showFabMenu, setShowFabMenu] = useState(false);
  
  // Code entry modal
  const [showCodeModal, setShowCodeModal] = useState<boolean>(!!codeParam);
  const [rawInput, setRawInput] = useState<string>(codeParam || '');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle');
  const [codeMessage, setCodeMessage] = useState<string>('');
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const code = useMemo(() => extractJoinCode(rawInput), [rawInput]);
  const chars = Array.from({ length: 6 }).map((_, i) => code[i] || '');

  // Deep link handling
  useEffect(() => {
    if (!codeParam) return;
    const extracted = extractJoinCode(codeParam);
    if (!extracted) return;

    setShowCodeModal(true);
    if (!currentProfile) {
      try { sessionStorage.setItem(PENDING_JOIN_KEY, extracted); } catch {}
      setCodeStatus('idle');
      setCodeMessage('Set up your profile first, then we\'ll join you automatically.');
    } else {
      setRawInput(extracted);
      setCodeMessage('');
    }
  }, [codeParam, currentProfile?.id]);

  // Load public events
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true') {
        setPublicEvents([]);
        return;
      }
      try {
        setLoadingEvents(true);
        const { loadPublicEventsFromCloud } = await import('../utils/eventSync');
        const list = await loadPublicEventsFromCloud();
        if (cancelled) return;
        setPublicEvents((list || []).filter((e: any) => !e.isCompleted && isUpcoming(e.date)));
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Auto-request location
  useEffect(() => {
    if (geoStatus === 'idle' && 'geolocation' in navigator) {
      requestLocation();
    }
  }, []);

  const homeCourseId = currentProfile?.preferences?.homeCourseId;
  const favoriteCourseIds: string[] = currentProfile?.preferences?.favoriteCourseIds || [];
  
  const allFavoriteIds = useMemo(() => {
    const set = new Set<string>();
    if (homeCourseId) set.add(homeCourseId);
    favoriteCourseIds.forEach(id => set.add(id));
    return set;
  }, [homeCourseId, favoriteCourseIds]);

  const getCourseCoords = (courseId: string) => {
    const c: any = getCourseById(courseId);
    if (!c) return undefined;
    const lat = typeof c.lat === 'number' ? c.lat : typeof c.latitude === 'number' ? c.latitude : undefined;
    const lng = typeof c.lng === 'number' ? c.lng : typeof c.longitude === 'number' ? c.longitude : undefined;
    return lat !== undefined && lng !== undefined ? { lat, lng } : undefined;
  };

  // All courses with distance
  const coursesWithDistance = useMemo(() => {
    const courses = getAllCourses();
    
    return courses.map((c: any) => {
      const coords = getCourseCoords(c.courseId || c.id);
      let miles: number | undefined;
      if (geoCoords && coords) {
        miles = haversineMiles(geoCoords, coords);
      }
      
      const eventCount = (publicEvents || []).filter(
        (e: any) => e.course?.courseId === (c.courseId || c.id)
      ).length;
      
      return {
        id: c.courseId || c.id,
        name: c.name,
        location: c.location || '',
        miles,
        eventCount,
        isHome: (c.courseId || c.id) === homeCourseId,
        isFavorite: allFavoriteIds.has(c.courseId || c.id)
      };
    }).sort((a, b) => {
      if (a.isHome && !b.isHome) return -1;
      if (!a.isHome && b.isHome) return 1;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.miles !== undefined && b.miles !== undefined) return a.miles - b.miles;
      if (a.miles !== undefined) return -1;
      if (b.miles !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [allCoursesFromHook, geoCoords, homeCourseId, allFavoriteIds, publicEvents]);

  // All events sorted
  const sortedEvents = useMemo(() => {
    return (publicEvents || []).map((e: any) => {
      const courseId = e.course?.courseId;
      const course = getCourseById(courseId);
      const coords = getCourseCoords(courseId);
      let miles: number | undefined;
      if (geoCoords && coords) {
        miles = haversineMiles(geoCoords, coords);
      }
      return {
        ...e,
        courseName: course?.name || courseId || 'Unknown Course',
        courseLocation: course?.location || '',
        miles,
        isHome: courseId === homeCourseId,
        isFavorite: allFavoriteIds.has(courseId || '')
      };
    }).sort((a, b) => {
      if (a.isHome && !b.isHome) return -1;
      if (!a.isHome && b.isHome) return 1;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (a.miles !== undefined && b.miles !== undefined) {
        const diff = a.miles - b.miles;
        if (Math.abs(diff) > 3) return diff;
      }
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [publicEvents, geoCoords, homeCourseId, allFavoriteIds]);

  // Favorites for display
  const favoriteCourses = useMemo(() => {
    return coursesWithDistance.filter(c => c.isFavorite || c.isHome);
  }, [coursesWithDistance]);

  // Filter by search
  const normalizedQuery = searchQuery.trim().toLowerCase();
  
  const filteredCourses = useMemo(() => {
    if (!normalizedQuery) return coursesWithDistance;
    return coursesWithDistance.filter(c => 
      c.name.toLowerCase().includes(normalizedQuery) ||
      c.location.toLowerCase().includes(normalizedQuery)
    );
  }, [coursesWithDistance, normalizedQuery]);

  const filteredEvents = useMemo(() => {
    if (!normalizedQuery) return sortedEvents;
    return sortedEvents.filter((e: any) => 
      (e.name || '').toLowerCase().includes(normalizedQuery) ||
      e.courseName.toLowerCase().includes(normalizedQuery)
    );
  }, [sortedEvents, normalizedQuery]);

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, sectionId: SectionId) => {
    setDraggedSection(sectionId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedSection(null);
    setDragOverSection(null);
  };

  const handleDragOver = (e: React.DragEvent, sectionId: SectionId) => {
    e.preventDefault();
    if (draggedSection && draggedSection !== sectionId) {
      setDragOverSection(sectionId);
    }
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: SectionId) => {
    e.preventDefault();
    if (!draggedSection || draggedSection === targetId) return;
    
    const newOrder = [...sectionOrder];
    const dragIdx = newOrder.indexOf(draggedSection);
    const targetIdx = newOrder.indexOf(targetId);
    
    newOrder.splice(dragIdx, 1);
    newOrder.splice(targetIdx, 0, draggedSection);
    
    setSectionOrder(newOrder);
    saveSectionOrder(newOrder);
    setDraggedSection(null);
    setDragOverSection(null);
  };

  // Handlers
  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus('ready');
      },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const handleJoinEvent = async (eventId: string) => {
    if (!currentProfile) {
      navigate('/');
      return;
    }

    const local = (myEvents || []).find((e: any) => e.id === eventId);
    if (local?.golfers?.some((g: any) => g.profileId === currentProfile.id)) {
      navigate(`/event/${eventId}`);
      return;
    }

    try {
      if (!local && import.meta.env.VITE_ENABLE_CLOUD_SYNC === 'true') {
        const { loadEventById } = await import('../utils/eventSync');
        const full = await loadEventById(eventId);
        if (full) {
          useStore.setState((s: any) => ({
            events: (s.events || []).some((e: any) => e.id === eventId) ? s.events : [...(s.events || []), full],
          }));
        }
      }

      await addGolferToEvent(eventId, currentProfile.id);
      addToast?.('Joined game!', 'success', 2500);
      navigate(`/event/${eventId}`);
    } catch {
      addToast?.('Could not join this game', 'error', 3500);
    }
  };

  const attemptJoinByCode = async () => {
    const normalized = extractJoinCode(rawInput);
    if (!normalized) {
      setCodeStatus('error');
      setCodeMessage('Enter the 6-character code.');
      return;
    }

    if (!currentProfile) {
      try { sessionStorage.setItem(PENDING_JOIN_KEY, normalized); } catch {}
      setCodeStatus('error');
      setCodeMessage('Create your profile first.');
      navigate('/');
      return;
    }

    setCodeStatus('joining');
    setCodeMessage('Joining...');
    const result = await joinEventByCode(normalized);
    if (result?.success) {
      setCodeStatus('success');
      setCodeMessage('Joined!');
      if (result?.eventId) setTimeout(() => navigate(`/event/${result.eventId}`), 250);
      return;
    }
    setCodeStatus('error');
    setCodeMessage(result?.error || 'Code not found. Check with the organizer.');
  };

  const tryPasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRawInput(text);
      requestAnimationFrame(() => hiddenInputRef.current?.focus());
    } catch {}
  };

  const toggleFavorite = (courseId: string) => {
    if (!currentProfile) return;
    
    const currentFavs = currentProfile.preferences?.favoriteCourseIds || [];
    const newFavs = currentFavs.includes(courseId)
      ? currentFavs.filter((id: string) => id !== courseId)
      : [...currentFavs, courseId];
    
    useStore.setState((s: any) => ({
      profiles: s.profiles.map((p: any) => 
        p.id === currentProfile.id 
          ? { ...p, preferences: { ...p.preferences, favoriteCourseIds: newFavs } }
          : p
      ),
      currentProfile: { 
        ...s.currentProfile, 
        preferences: { ...s.currentProfile.preferences, favoriteCourseIds: newFavs } 
      }
    }));
    
    addToast?.(newFavs.includes(courseId) ? 'Added to favorites' : 'Removed from favorites', 'success', 1500);
  };

  const isLoading = loadingCourses || loadingEvents;

  // Section config (matches Dashboard pattern)
  const sectionConfig: Record<SectionId, {
    show: boolean;
    isExpanded: boolean;
    setExpanded: (v: boolean) => void;
    showAll: boolean;
    setShowAll: (v: boolean) => void;
    icon: React.ReactNode;
    label: string;
    count: number;
    gradient: string;
    badgeBg: string;
    labelColor: string;
    items: any[];
  }> = {
    courses: {
      show: true,
      isExpanded: showCourses,
      setExpanded: setShowCourses,
      showAll: showAllCourses,
      setShowAll: setShowAllCourses,
      icon: <span className="text-base">📍</span>,
      label: 'Courses',
      count: filteredCourses.length,
      gradient: 'from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800 hover:from-blue-100',
      badgeBg: 'bg-blue-100 dark:bg-blue-900/50',
      labelColor: 'text-gray-800 dark:text-white',
      items: filteredCourses,
    },
    events: {
      show: true,
      isExpanded: showEvents,
      setExpanded: setShowEvents,
      showAll: showAllEvents,
      setShowAll: setShowAllEvents,
      icon: <span className="text-base">⛳</span>,
      label: 'Events',
      count: filteredEvents.length,
      gradient: 'from-primary-50 to-white dark:from-primary-900/20 dark:to-slate-800 hover:from-primary-100',
      badgeBg: 'bg-primary-100 dark:bg-primary-900/50',
      labelColor: 'text-gray-800 dark:text-white',
      items: filteredEvents,
    },
  };

  // Course card component - matches Dashboard style
  const CourseCard = ({ course }: { course: typeof coursesWithDistance[0] }) => (
    <button
      onClick={() => setSearchQuery(course.name)}
      className={`w-full text-left flex items-center gap-3 p-2.5 rounded-lg border transition-all group ${
        course.isHome 
          ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800' 
          : 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600'
      }`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); toggleFavorite(course.id); }}
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
          course.isHome 
            ? 'bg-amber-100 dark:bg-amber-900/50' 
            : course.isFavorite 
              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600'
              : 'bg-white dark:bg-slate-600 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 border border-gray-200 dark:border-slate-500'
        }`}
      >
        <span className="text-sm">{course.isHome ? '🏠' : course.isFavorite ? '⭐' : '☆'}</span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-gray-900 dark:text-white truncate flex items-center gap-1.5">
          {course.name}
          {course.isHome && <span className="text-[8px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">HOME</span>}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
          {course.miles !== undefined && <span>{Math.round(course.miles)} mi</span>}
          {course.eventCount > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">{course.eventCount} game{course.eventCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <svg className="w-4 h-4 text-gray-300 dark:text-slate-500 group-hover:text-gray-400 dark:group-hover:text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );

  // Event card component - matches Dashboard style
  const EventCard = ({ event }: { event: any }) => {
    const alreadyJoined = (event.golfers || []).some((g: any) => g.profileId === currentProfile?.id);
    return (
      <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
        event.isHome 
          ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-800' 
          : 'bg-white dark:bg-slate-700/50 hover:bg-primary-50 dark:hover:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-primary-300 dark:hover:border-primary-700'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          event.isHome ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-primary-100 dark:bg-primary-900/50'
        }`}>
          <span className="text-sm">{event.isHome ? '🏠' : '⛳'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
            {event.name || 'Golf Game'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <span className="truncate">{event.courseName}</span>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="font-medium">{formatDate(event.date)}</span>
            {event.miles !== undefined && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span>{Math.round(event.miles)} mi</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); handleJoinEvent(event.id); }}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex-shrink-0 ${
            alreadyJoined
              ? 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-500'
              : 'bg-gradient-to-r from-accent to-orange-500 text-white shadow-sm hover:shadow-md'
          }`}
        >
          {alreadyJoined ? 'Open' : 'Join'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-black text-gray-900 dark:text-white">Join a Game</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Find events near you or enter a code</p>
        </div>
      </div>

      {/* Favorites chips */}
      {favoriteCourses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">⭐</span>
          {favoriteCourses.slice(0, 5).map((c) => (
            <button
              key={c.id}
              onClick={() => setSearchQuery(c.name)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                c.isHome
                  ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {c.isHome && <span>🏠</span>}
              {c.name}
              {c.eventCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{c.eventCount}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Search Bar - matches Dashboard */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search courses & events..."
          className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-700 focus:border-primary-300 shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Location prompt */}
      {geoStatus === 'idle' && (
        <button
          onClick={requestLocation}
          className="w-full py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          Enable location for nearby results
        </button>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 text-center shadow-sm">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto mb-2"></div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      )}

      {/* Cloud sync notice */}
      {!isLoading && import.meta.env.VITE_ENABLE_CLOUD_SYNC !== 'true' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
          Public events require cloud sync. Tap + to enter a code for private events.
        </div>
      )}

      {/* Sections - Draggable like Dashboard */}
      {!isLoading && (
        <div className="space-y-3">
          {sectionOrder.map((sectionId) => {
            const config = sectionConfig[sectionId];
            if (!config.show) return null;
            
            const isDragging = draggedSection === sectionId;
            const isDragOver = dragOverSection === sectionId;
            
            const hasMoreItems = config.items.length > DEFAULT_ITEMS_LIMIT;
            const itemsToShow = config.showAll ? config.items : config.items.slice(0, DEFAULT_ITEMS_LIMIT);
            const hiddenCount = config.items.length - DEFAULT_ITEMS_LIMIT;
            
            return (
              <div
                key={sectionId}
                draggable
                onDragStart={(e) => handleDragStart(e, sectionId)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, sectionId)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, sectionId)}
                className={`bg-white dark:bg-slate-800 rounded-2xl border-2 shadow-sm overflow-hidden transition-all duration-200 ${
                  isDragging ? 'opacity-50 scale-[0.98]' : ''
                } ${
                  isDragOver ? 'border-primary-400 border-dashed bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-slate-700'
                }`}
              >
                <div className={`flex items-center bg-gradient-to-r ${config.gradient} transition-colors`}>
                  {/* Drag Handle */}
                  <div 
                    className="px-2 py-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
                    title="Drag to reorder"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                    </svg>
                  </div>
                  
                  {/* Accordion Header */}
                  <button
                    onClick={() => config.setExpanded(!config.isExpanded)}
                    className="flex-1 flex items-center gap-2 pr-4 py-3"
                  >
                    {config.icon}
                    <h3 className={`font-bold ${config.labelColor} text-sm uppercase tracking-wide`}>{config.label}</h3>
                    <span className={`text-xs text-gray-500 ${config.badgeBg} px-2 py-0.5 rounded-full font-medium`}>{config.count}</span>
                    <svg 
                      className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-200 ${config.isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                
                {/* Content */}
                {config.isExpanded && (
                  <div className="px-3 pb-3 space-y-1.5">
                    {config.items.length === 0 ? (
                      <div className="text-sm text-center text-gray-500 dark:text-gray-400 py-4">
                        {sectionId === 'events' ? 'No public events available' : 'No courses found'}
                      </div>
                    ) : (
                      <>
                        {itemsToShow.map((item: any) => (
                          sectionId === 'courses' 
                            ? <CourseCard key={item.id} course={item} />
                            : <EventCard key={item.id} event={item} />
                        ))}
                        
                        {hasMoreItems && !config.showAll && (
                          <button
                            onClick={() => config.setShowAll(true)}
                            className="w-full py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-xl transition-colors border border-primary-200 dark:border-primary-800"
                          >
                            Show {hiddenCount} more {config.label.toLowerCase()} →
                          </button>
                        )}
                        {config.showAll && hasMoreItems && (
                          <button
                            onClick={() => config.setShowAll(false)}
                            className="w-full py-2 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            ← Show less
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAB - Opens action menu like Dashboard */}
      <button
        onClick={() => setShowFabMenu(true)}
        className="fixed right-4 z-40 w-16 h-16 bg-gradient-to-br from-accent to-orange-600 rounded-full shadow-lg shadow-accent/40 flex items-center justify-center text-white text-3xl font-bold hover:scale-105 active:scale-95 transition-transform fab-position"
        aria-label="Quick actions"
      >
        <span className={`transition-transform duration-200 ${showFabMenu ? 'rotate-45' : ''}`}>+</span>
      </button>

      {/* FAB Action Sheet - like Dashboard */}
      {showFabMenu && createPortal(
        <div 
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowFabMenu(false)}
        >
          <div 
            className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
            </div>
            
            {/* Header */}
            <div className="px-5 pb-3 text-center">
              <h2 className="text-lg font-bold text-gray-900">How would you like to join?</h2>
            </div>
            
            {/* Action buttons */}
            <div className="px-4 pb-4 space-y-2">
              {/* Enter Code - Most prominent */}
              <button
                onClick={() => { setShowFabMenu(false); setShowCodeModal(true); }}
                className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-accent to-orange-500 rounded-2xl text-white hover:from-orange-500 hover:to-accent transition-all shadow-md"
              >
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                  🎫
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-lg">Enter Code</div>
                  <div className="text-orange-100 text-sm">Have an invite code? Enter it here</div>
                </div>
                <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Search for Course */}
              <button
                onClick={() => { 
                  setShowFabMenu(false); 
                  setShowCourses(true);
                  setShowEvents(false);
                  setSearchQuery('');
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.setAttribute('placeholder', 'Search for a course...');
                  }, 100);
                }}
                className="w-full flex items-center gap-4 p-4 bg-blue-50 rounded-2xl hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-200 flex items-center justify-center text-2xl flex-shrink-0">
                  📍
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Search Courses</div>
                  <div className="text-gray-500 text-sm">Find your course by name</div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Search for Event */}
              <button
                onClick={() => { 
                  setShowFabMenu(false); 
                  setShowEvents(true);
                  setShowCourses(false);
                  setSearchQuery('');
                  setTimeout(() => {
                    searchInputRef.current?.focus();
                    searchInputRef.current?.setAttribute('placeholder', 'Search for an event...');
                  }, 100);
                }}
                className="w-full flex items-center gap-4 p-4 bg-primary-50 rounded-2xl hover:bg-primary-100 transition-colors border border-primary-200"
              >
                <div className="w-14 h-14 rounded-xl bg-primary-200 flex items-center justify-center text-2xl flex-shrink-0">
                  ⛳
                </div>
                <div className="text-left flex-1">
                  <div className="font-bold text-gray-900">Search Events</div>
                  <div className="text-gray-500 text-sm">Find an event by name</div>
                </div>
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Cancel button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowFabMenu(false)}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Code Entry Modal - slide up from bottom like Dashboard FAB menu */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCodeModal(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl animate-slide-up pb-safe">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            
            {/* Header */}
            <div className="px-5 pb-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-orange-500 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Enter Join Code</h2>
                    <p className="text-xs text-gray-500">Paste a link or type the 6-digit code</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4">
              {codeMessage && (
                <div
                  className={`mb-4 p-3 rounded-xl text-sm font-semibold ${
                    codeStatus === 'success'
                      ? 'bg-green-100 text-green-800'
                      : codeStatus === 'error'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {codeMessage}
                </div>
              )}

              <div
                className="relative"
                onClick={() => hiddenInputRef.current?.focus()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && hiddenInputRef.current?.focus()}
              >
                <input
                  ref={hiddenInputRef}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && attemptJoinByCode()}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="absolute inset-0 opacity-0"
                  aria-label="Join code"
                />

                <div className="grid grid-cols-6 gap-2">
                  {chars.map((c, i) => (
                    <div
                      key={i}
                      className={`h-12 rounded-xl border-2 flex items-center justify-center text-xl font-black font-mono ${
                        codeStatus === 'error'
                          ? 'border-amber-400 bg-amber-50 text-amber-900'
                          : 'border-gray-300 bg-white text-gray-900'
                      }`}
                    >
                      {c || <span className="text-gray-300">•</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={tryPasteFromClipboard}
                  className="py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold text-sm hover:bg-gray-200 transition"
                >
                  📋 Paste
                </button>
                <button
                  type="button"
                  onClick={attemptJoinByCode}
                  disabled={codeStatus === 'joining' || extractJoinCode(rawInput).length !== 6}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-accent to-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:shadow-none transition"
                >
                  {codeStatus === 'joining' ? 'Joining...' : 'Join'}
                </button>
              </div>
            </div>
            
            {/* Cancel button */}
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowCodeModal(false)}
                className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JoinEventPage;
