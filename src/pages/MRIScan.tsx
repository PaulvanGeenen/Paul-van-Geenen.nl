import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ShieldAlert, Layers, ZoomIn, Move, Sun, RotateCcw, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as cornerstone from 'cornerstone-core';
import * as cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import * as dicomParser from 'dicom-parser';

import * as cornerstoneTools from 'cornerstone-tools';
import * as cornerstoneMath from 'cornerstone-math';
import Hammer from 'hammerjs';

// Configure cornerstone
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.cornerstoneMath = cornerstoneMath;
cornerstoneTools.external.Hammer = Hammer;

// Configure WADO loader - disabling web workers can prevent 404s in sandboxed environments
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr: XMLHttpRequest) {
    // Add custom headers if needed
  },
  decodeConfig: {
    useWebWorkers: false,
  }
});

cornerstoneTools.init({
  showCursor: true,
  globalToolSyncEnabled: false,
  touchInput: {
    enable: true
  }
});

// Add tools globally once
try {
  cornerstoneTools.addTool(cornerstoneTools.WwwcTool);
  cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
  cornerstoneTools.addTool(cornerstoneTools.PanTool);
  cornerstoneTools.addTool(cornerstoneTools.MagnifyTool, {
    configuration: {
      magnifySize: 150,
      magnificationLevel: 2
    }
  });
  
  // Add touch tools for mobile support
  if (cornerstoneTools.WwwcTouchTool) cornerstoneTools.addTool(cornerstoneTools.WwwcTouchTool);
  if (cornerstoneTools.ZoomTouchPinchTool) cornerstoneTools.addTool(cornerstoneTools.ZoomTouchPinchTool);
  if (cornerstoneTools.PanTouchTool) cornerstoneTools.addTool(cornerstoneTools.PanTouchTool);
  if ((cornerstoneTools as any).MagnifyTouchTool) cornerstoneTools.addTool((cornerstoneTools as any).MagnifyTouchTool);
} catch (e) {
  // Already added
}

// Scan configurations (Basic empty state)
const INITIAL_SCANS: Record<string, Scan> = {};

interface Scan {
  id: string;
  name: string;
  series: string;
  files: string[];
}

const SCAN_EXPLANATIONS: Record<string, string> = {
  'SE000001': 'Hals en Nek (Axiaal): Dit is een horizontale doorsnede van de hals- en neksregio (bovenste deel van de nek), ter hoogte van de oorspeekselklieren (parotis). We kijken hier van onderaf (alsof we vanaf je voeten omhoog kijken). Let op: Rechts voor de kijker is dus jouw linkerzijde. De tumor is hier al goed te zien als een massa in de linker speekselklier.',
  'SE000002': 'Vooraanzicht (Coronaal): In deze scan kijken we recht tegen de bovenste hals- en mondregio aan, van voren naar achteren. Je kijkt jezelf hier letterlijk recht in de ogen. Terwijl je scrolt, beweeg je van je gezicht naar achteren door de hals- en mondregio. Let op: Rechts voor de kijker is jouw linkerzijde.',
  'SE000003': 'Gedetailleerde dwarsdoorsnede: Dit is ook een horizontale doorsnede van onderaf gezien. De tumor (de opvallende "bal") is hier nog duidelijker zichtbaar in de linker oorspeekselklier. Je ziet goed hoe de tumor mooi afgrensbaar is en de omliggende weefsels — zoals de gehoorgang — voorzichtig opzij duwt. Omdat de tumor de ruimte bij het oor vernauwt, verklaart dit het ongemakkelijke gevoel.',
  'SE000011': 'Halsgebied (Axiaal): Een dwarsdoorsnede gericht op de weke delen in de hals. We kijken ook hier van onderaf, met extra aandacht voor de spiegeling tussen de linker en rechter speekselklieren.',
  'SE000012': 'Dixon techniek (Axiaal): Een speciale techniek waarbij vetweefsel wordt onderdrukt om afwijkingen beter te laten oplichten.',
  'SE000013': 'Contrast-opname (Axiaal): Hier kijken we hoe de tumor bloed opneemt. Omdat we van onderaf kijken, zie je links (jouw rechterkant) een gezonde klier en rechts (jouw linkerkant) de tumor karakteristiek aankleuren.',
  'SE000014': 'Rapport: De samenvatting van de radioloog waarin de bevindingen over de goedaardige tumor worden bevestigd.'
};

export function MRIScan() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [scans, setScans] = useState<Record<string, Scan>>(INITIAL_SCANS);
  const [selectedScan, setSelectedScan] = useState<string>('SE000002');
  const [currentSlice, setCurrentSlice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState('Pan');
  const [viewport, setViewport] = useState<any>(null);
  const [isReport, setIsReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchScans = async () => {
      try {
        const response = await fetch('/api/mri-scans');
        
        // If we get HTML instead of JSON (typical for static hosting error), trigger fallback
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn('API returned HTML, likely static hosting fallback. Using manual discovery.');
        } else {
          const data = await response.json();
          if (data.scans && Object.keys(data.scans).length > 0) {
            setScans(data.scans);
            const keys = Object.keys(data.scans);
            const defaultScan = keys.includes('SE000002') ? 'SE000002' : keys[0];
            setSelectedScan(defaultScan);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('API Fetch failed, using static fallback discovery.', err);
      }

      // Hardcoded fallback for static environments like traditional hosting
      const fallbackScans: Record<string, Scan> = {
        'SE000002': {
          id: 'SE000002',
          name: 'Schedel basis (Dwarsdoorsnede - Axiaal)',
          series: 'SE000002',
          files: Array.from({ length: 30 }, (_, i) => `/mri/SE000002/IM${String(i + 1).padStart(6, '0')}`)
        },
        'SE000003': {
          id: 'SE000003',
          name: 'Gedetailleerde dwarsdoorsnede',
          series: 'SE000003',
          files: Array.from({ length: 35 }, (_, i) => `/mri/SE000003/IM${String(i + 1).padStart(6, '0')}`)
        },
        'SE000014': {
          id: 'SE000014',
          name: 'Radiologisch Rapport (Samenvatting)',
          series: 'SE000014',
          files: ['/mri/SE000014/IM000001']
        }
      };
      
      setScans(fallbackScans);
      setSelectedScan('SE000002');
      setIsLoading(false);
    };
    fetchScans();
  }, []);

  const currentScan = scans[selectedScan];
  const currentScanFiles = currentScan?.files || [];

  useEffect(() => {
    if (!viewerRef.current) return;

    const element = viewerRef.current;
    
    // Check if it's a report (Special handling for SE000014)
    if (selectedScan === 'SE000014') {
      setIsReport(true);
      setReportContent(
        "Radiologische bevindingen: Er is een verdenking op een Warthin tumor (cystadenolymphoom) in de linker parotis (speekselklier). De afwijking is scherp begrensd en vertoont kenmerkende aankleuring op de contrastopnames. Geen aanwijzingen voor maligniteit in de omliggende weefsels.\n\n" +
        "Begrijpelijke uitleg: Er is een zwelling gevonden in de linker speekselklier. De radioloog denkt dat dit een 'Warthin tumor' is, wat een goedaardige vorm van een tumor is. De zwelling heeft een duidelijke rand en ziet er op de scans heel herkenbaar uit voor dit type. Het belangrijkste is dat er geen aanwijzingen zijn voor kwaadaardigheid."
      );
      setIsLoading(false);
      return;
    } else {
      setIsReport(false);
      setReportContent(null);
    }
    
    // Enable cornerstone on the element
    try {
      cornerstone.getEnabledElement(element);
    } catch (e) {
      cornerstone.enable(element);
    }

    // Setup tools for this element
    const initTools = () => {
      try {
        // Enable touch input for this element
        cornerstoneTools.touchInput.enable(element);
      } catch (e) {
        console.warn('Touch enable warning:', e);
      }
    };

    initTools();
    
    const getImageUrl = (url: string) => {
      // Standard cornerstone imageId format
      // Add contentType=application/dicom if the file has no extension (as seen in the file tree)
      if (url.includes('.')) return `wadouri:${url}`;
      return `wadouri:${url}?contentType=application/dicom`;
    };

    const loadAndDisplayImage = async (index: number) => {
      if (!currentScanFiles || currentScanFiles.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      const fileUrl = currentScanFiles[index];
      if (!fileUrl) {
        setIsLoading(false);
        return;
      }

      const imageId = getImageUrl(fileUrl);
      
      try {
        const image = await cornerstone.loadAndCacheImage(imageId);
        
        // Final check before displaying
        try {
          cornerstone.getEnabledElement(element);
        } catch (e) {
          return; // Element no longer valid
        }

        cornerstone.displayImage(element, image);
        
        // Only reset on first load of a new scan
        if (index === 0) {
          cornerstone.reset(element);
        }

        // Activate tools after image is shown
        try {
          // Standard mouse tools
          cornerstoneTools.setToolActiveForElement(element, activeTool, { mouseButtonMask: 1 });
          cornerstoneTools.setToolActiveForElement(element, 'Zoom', { mouseButtonMask: 2 });
          cornerstoneTools.setToolActiveForElement(element, 'Pan', { mouseButtonMask: 4 });
          
          // Touch tools - only activate if they exist
          const touchToEnable = ['WwwcTouch', 'ZoomTouchPinch', 'PanTouch'];
          touchToEnable.forEach(name => {
            try {
              cornerstoneTools.setToolActiveForElement(element, name, {});
            } catch (e) {}
          });
          
          // Special handling for Magnify - it handles both but we make sure it's active
          if (activeTool === 'Magnify') {
            try {
              cornerstoneTools.setToolActiveForElement(element, 'Magnify', { mouseButtonMask: 1 });
            } catch (e) {}
          }
        } catch (e) {
          console.warn('Error activating tools:', e);
        }

        setIsLoading(false);

        // Pre-cache
        if (currentScanFiles.length > 1) {
          currentScanFiles.forEach((file, i) => {
            if (i !== index) {
              cornerstone.loadAndCacheImage(getImageUrl(file)).catch(() => {});
            }
          });
        }
      } catch (err) {
        console.error('Error loading image:', err);
        setError(`Fout bij laden van beeld. Controleer of de bestanden aanwezig zijn.`);
        setIsLoading(false);
      }
    };

    loadAndDisplayImage(currentSlice);

    const onImageRendered = (e: any) => {
      setViewport(e.detail.viewport);
    };
    element.addEventListener('cornerstoneimagerendered', onImageRendered);

    // Robust wheel handler that doesn't conflict
    const handleMouseWheel = (e: WheelEvent) => {
      // If we are loading or it's a report, do nothing
      if (isReport || currentScanFiles.length <= 1) return;
      
      // Stop the page from scrolling while viewing the MRI
      e.preventDefault();
      
      // Calculate next slice
      const delta = e.deltaY > 0 ? 1 : -1;
      
      // We use a functional update and ensure bounds
      setCurrentSlice(prev => {
        const next = Math.max(0, Math.min(prev + delta, currentScanFiles.length - 1));
        return next;
      });
    };

    element.addEventListener('wheel', handleMouseWheel, { passive: false });

    const handleResize = () => {
      try {
        cornerstone.resize(element);
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    return () => {
      element.removeEventListener('cornerstoneimagerendered', onImageRendered);
      element.removeEventListener('wheel', handleMouseWheel);
      window.removeEventListener('resize', handleResize);
      
      try {
        cornerstone.disable(element);
      } catch (e) {}
    };
  }, [selectedScan, scans]); // Re-run when scan changes or scans are loaded

  // Separate effect for slice changes to keep it fast
  useEffect(() => {
    if (!viewerRef.current || isReport || !currentScanFiles || currentScanFiles.length === 0) return;
    
    const element = viewerRef.current;
    const fileUrl = currentScanFiles[currentSlice];
    if (!fileUrl) return;

    const getImageUrl = (url: string) => {
      if (url.includes('.')) return `wadouri:${url}`;
      return `wadouri:${url}?contentType=application/dicom`;
    };

    const imageId = getImageUrl(fileUrl);
    
    cornerstone.loadAndCacheImage(imageId).then(image => {
      try {
        cornerstone.getEnabledElement(element);
        cornerstone.displayImage(element, image);
      } catch (e) {}
    }).catch(() => {});
  }, [currentSlice]);


  const handleSliceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSlice(parseInt(e.target.value));
  };

  const handleScanSwitch = (id: string) => {
    setSelectedScan(id);
    setCurrentSlice(0);
  };

  const toggleTool = (toolName: string) => {
    if (!viewerRef.current || isReport || isLoading) return;
    setActiveTool(toolName);
    const element = viewerRef.current;
    
    try {
      // Disable all mouse tools on button 1 first to be clean
      const toolsToDeactivate = ['Wwwc', 'Zoom', 'Pan', 'Magnify'];
      toolsToDeactivate.forEach(t => {
        cornerstoneTools.setToolPassiveForElement(element, t);
      });
      
      // Activate selected tool
      cornerstoneTools.setToolActiveForElement(element, toolName, { mouseButtonMask: 1 });
      
      // For touch tools
      if (toolName === 'Wwwc') {
        try { cornerstoneTools.setToolActiveForElement(element, 'WwwcTouch', {}); } catch (e) {}
      } else if (toolName === 'Zoom') {
        try { cornerstoneTools.setToolActiveForElement(element, 'ZoomTouchPinch', {}); } catch (e) {}
      } else if (toolName === 'Pan') {
        try { cornerstoneTools.setToolActiveForElement(element, 'PanTouch', {}); } catch (e) {}
      } else if (toolName === 'Magnify') {
        try { cornerstoneTools.setToolActiveForElement(element, 'Magnify', { mouseButtonMask: 1 }); } catch (e) {}
      }
    } catch (e) {
      console.error('Tool toggle error:', e);
    }
  };

  const handleReset = () => {
    if (!viewerRef.current || isReport) return;
    cornerstone.reset(viewerRef.current);
    const vp = cornerstone.getViewport(viewerRef.current);
    if (vp) setViewport(vp);
  };

  const handleVOIChange = (type: 'width' | 'center', value: number) => {
    if (!viewerRef.current || isReport) return;
    const element = viewerRef.current;
    const vp = cornerstone.getViewport(element);
    if (!vp) return;
    
    if (type === 'width') vp.voi.windowWidth = value;
    else vp.voi.windowCenter = value;
    
    cornerstone.setViewport(element, vp);
    setViewport({ ...vp });
  };

  const handleSliderTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (isReport || currentScanFiles.length <= 1) return;
    
    // Stop the page from scrolling
    if ('cancelable' in e && e.cancelable) {
      e.preventDefault();
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Vertical slider: 
    // y = 0 (top) -> max slice
    // y = height (bottom) -> 0 slice
    // We adjust for the top/bottom labels padding if necessary, but linear is a good start
    const val = 1 - (clientY - rect.top) / rect.height;
    const nextSlice = Math.max(0, Math.min(Math.round(val * (currentScanFiles.length - 1)), currentScanFiles.length - 1));
    
    setCurrentSlice(nextSlice);
  };

  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showSliderHint, setShowSliderHint] = useState(true);

  // Trigger resize when closing report to ensure images load correctly on iPad/Touch devices
  useEffect(() => {
    if (!isReport && viewerRef.current) {
      setTimeout(() => {
        try {
          cornerstone.resize(viewerRef.current!);
        } catch (e) {}
      }, 50);
    }
  }, [isReport]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSliderHint(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  const ANATOMY_HOTSPOTS: Record<string, any[]> = {
    'SE000001': [
      { 
        id: 'tumor', 
        name: 'WARTHIN TUMOR', 
        sub: 'DE "BAL"', 
        top: '25%', 
        left: '88%', 
        sliceRange: [12, 26],
        color: 'border-red-500',
        labelColor: 'bg-red-600/90'
      },
      { 
        id: 'parotis_r', 
        name: 'RECHTER PAROTIS', 
        sub: 'GEZONDE KLIER', 
        top: '42%', 
        left: '16%', 
        sliceRange: [15, 25],
        color: 'border-blue-400/40',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'ear_canal_l', 
        name: 'GEHOORGANG (L)', 
        sub: 'HIER WORDT HET NAUW', 
        top: '38%', 
        left: '80%', 
        sliceRange: [20, 26],
        color: 'border-blue-400/20',
        labelColor: 'bg-blue-600/30'
      },
      { 
        id: 'ear_canal_r', 
        name: 'GEHOORGANG (R)', 
        sub: 'HIER NOG OPEN', 
        top: '38%', 
        left: '20%', 
        sliceRange: [20, 26],
        color: 'border-blue-400/20',
        labelColor: 'bg-blue-600/30'
      },
      { 
        id: 'tongue', 
        name: 'TONG', 
        sub: 'LINGUA', 
        top: '35%', 
        left: '50%', 
        sliceRange: [10, 22],
        color: 'border-white/20',
        labelColor: 'bg-white/10'
      },
      { 
        id: 'brainstem', 
        name: 'HERSENSTAM', 
        sub: 'PONS / MEDULLA', 
        top: '52%', 
        left: '50%', 
        sliceRange: [15, 28],
        color: 'border-green-400/30',
        labelColor: 'bg-green-600/40'
      },
      { 
        id: 'carotis_l', 
        name: 'HALSSLAGADER (L)', 
        sub: 'A. CAROTIS INT.', 
        top: '55%', 
        left: '60%', 
        sliceRange: [15, 28],
        color: 'border-red-400/40',
        labelColor: 'bg-red-800/40'
      },
      { 
        id: 'carotis_r', 
        name: 'HALSSLAGADER (R)', 
        sub: 'A. CAROTIS INT.', 
        top: '55%', 
        left: '40%', 
        sliceRange: [15, 28],
        color: 'border-red-400/40',
        labelColor: 'bg-red-800/40'
      }
    ],
    'SE000002': [
      { 
        id: 'tumor', 
        name: 'WARTHIN TUMOR', 
        sub: 'DE "BAL"', 
        top: '28%', 
        left: '88%', 
        sliceRange: [12, 26],
        color: 'border-red-500',
        labelColor: 'bg-red-600/90'
      },
      { 
        id: 'ear_canal_l', 
        name: 'GEHOORGANG (L)', 
        sub: 'HIER WORDT HET NAUW', 
        top: '38%', 
        left: '64%', 
        sliceRange: [18, 25],
        color: 'border-blue-400/50',
        labelColor: 'bg-blue-600/60'
      },
      { 
        id: 'ear_canal_r', 
        name: 'GEHOORGANG (R)', 
        sub: 'NORMAAL / OPEN', 
        top: '38%', 
        left: '36%', 
        sliceRange: [18, 25],
        color: 'border-blue-400/20',
        labelColor: 'bg-blue-600/30'
      },
      { 
        id: 'parotis_r', 
        name: 'RECHTER PAROTIS', 
        sub: 'GEZONDE KLIER', 
        top: '42%', 
        left: '38%', 
        sliceRange: [15, 25],
        color: 'border-blue-400/40',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'eye_l', 
        name: 'OOG (L)', 
        sub: 'ORBITA', 
        top: '15%', 
        left: '58%', 
        sliceRange: [10, 18],
        color: 'border-blue-400/30',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'eye_r', 
        name: 'OOG (R)', 
        sub: 'ORBITA', 
        top: '15%', 
        left: '42%', 
        sliceRange: [10, 18],
        color: 'border-blue-400/30',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'tongue', 
        name: 'TONG', 
        sub: 'LINGUA', 
        top: '35%', 
        left: '50%', 
        sliceRange: [10, 22],
        color: 'border-white/20',
        labelColor: 'bg-white/10'
      },
      { 
        id: 'nasal_septum', 
        name: 'NEUSTUSSENSCHOT', 
        sub: 'SEPTUM NASI', 
        top: '22%', 
        left: '50%', 
        sliceRange: [18, 30],
        color: 'border-white/30',
        labelColor: 'bg-white/20'
      },
      { 
        id: 'teeth', 
        name: 'GEBIT / TANDEN', 
        sub: 'DENTES', 
        top: '25%', 
        left: '50%', 
        sliceRange: [15, 20],
        color: 'border-white/40',
        labelColor: 'bg-white/30'
      },
      { 
        id: 'soft_palate', 
        name: 'VERHEMELTE', 
        sub: 'PALATUM MOLLE', 
        top: '42%', 
        left: '50%', 
        sliceRange: [10, 18],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      },
      { 
        id: 'sinus_l', 
        name: 'KAAKHOLTE (L)', 
        sub: 'SINUS MAXILLARIS', 
        top: '22%', 
        left: '58%', 
        sliceRange: [18, 28],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      },
      { 
        id: 'sinus_r', 
        name: 'KAAKHOLTE (R)', 
        sub: 'SINUS MAXILLARIS', 
        top: '22%', 
        left: '42%', 
        sliceRange: [18, 28],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      },
      { 
        id: 'masseter_l', 
        name: 'KAUWSPIER (L)', 
        sub: 'M. MASSETER', 
        top: '40%', 
        left: '74%', 
        sliceRange: [10, 25],
        color: 'border-purple-400/20',
        labelColor: 'bg-purple-600/30'
      },
      { 
        id: 'masseter_r', 
        name: 'KAUWSPIER (R)', 
        sub: 'M. MASSETER', 
        top: '40%', 
        left: '26%', 
        sliceRange: [10, 25],
        color: 'border-purple-400/20',
        labelColor: 'bg-purple-600/30'
      },
      { 
        id: 'condyle_l', 
        name: 'KAAKGEWRICHT (L)', 
        sub: 'CONDYLUS', 
        top: '48%', 
        left: '68%', 
        sliceRange: [22, 28],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      },
      { 
        id: 'condyle_r', 
        name: 'KAAKGEWRICHT (R)', 
        sub: 'CONDYLUS', 
        top: '48%', 
        left: '32%', 
        sliceRange: [22, 28],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      },
      { 
        id: 'maxilla', 
        name: 'BOVENKAAK', 
        sub: 'MAXILLA', 
        top: '15%', 
        left: '50%', 
        sliceRange: [20, 26],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      }
    ],
    'SE000003': [
      { 
        id: 'tumor', 
        name: 'WARTHIN TUMOR', 
        sub: 'DRUKT TEGEN GEHOORGANG', 
        top: '44%', 
        left: '79%', 
        sliceRange: [15, 28],
        color: 'border-red-500',
        labelColor: 'bg-red-600/90'
      },
      { 
        id: 'ear_canal_l', 
        name: 'GEHOORGANG (L)', 
        sub: 'VRIJWEL DICHTGEDRUKT', 
        top: '38%', 
        left: '82%', 
        sliceRange: [18, 30],
        color: 'border-blue-400/50',
        labelColor: 'bg-blue-600/70'
      },
      { 
        id: 'parotis_r', 
        name: 'RECHTER PAROTIS', 
        sub: 'GEZONDE KLIER', 
        top: '42%', 
        left: '22%', 
        sliceRange: [16, 26],
        color: 'border-blue-400/40',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'eye_l', 
        name: 'OOG (L)', 
        sub: 'ORBITA', 
        top: '15%', 
        left: '66%', 
        sliceRange: [10, 18],
        color: 'border-blue-400/30',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'eye_r', 
        name: 'OOG (R)', 
        sub: 'ORBITA', 
        top: '15%', 
        left: '34%', 
        sliceRange: [10, 18],
        color: 'border-blue-400/30',
        labelColor: 'bg-blue-600/40'
      },
      { 
        id: 'sinus_l', 
        name: 'KAAKHOLTE (L)', 
        sub: 'SINUS MAXILLARIS', 
        top: '22%', 
        left: '60%', 
        sliceRange: [18, 28],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      },
      { 
        id: 'sinus_r', 
        name: 'KAAKHOLTE (R)', 
        sub: 'SINUS MAXILLARIS', 
        top: '22%', 
        left: '40%', 
        sliceRange: [18, 28],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      },
      { 
        id: 'tongue', 
        name: 'TONG', 
        sub: 'LINGUA', 
        top: '35%', 
        left: '50%', 
        sliceRange: [10, 22],
        color: 'border-white/20',
        labelColor: 'bg-white/10'
      },
      { 
        id: 'brain', 
        name: 'HERSENEN', 
        sub: 'CEREBRUM', 
        top: '60%', 
        left: '50%', 
        sliceRange: [10, 34],
        color: 'border-green-400/20',
        labelColor: 'bg-green-700/30'
      },
      { 
        id: 'brainstem', 
        name: 'HERSENSTAM', 
        sub: 'PONS / MEDULLA', 
        top: '52%', 
        left: '50%', 
        sliceRange: [15, 28],
        color: 'border-green-400/30',
        labelColor: 'bg-green-600/40'
      },
      { 
        id: 'mandible_l', 
        name: 'ONDERKAAK (L)', 
        sub: 'MANDIBULA', 
        top: '68%', 
        left: '65%', 
        sliceRange: [12, 22],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      },
      { 
        id: 'mandible_r', 
        name: 'ONDERKAAK (R)', 
        sub: 'MANDIBULA', 
        top: '68%', 
        left: '35%', 
        sliceRange: [12, 22],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      },
      { 
        id: 'maxilla', 
        name: 'BOVENKAAK', 
        sub: 'MAXILLA', 
        top: '52%', 
        left: '50%', 
        sliceRange: [10, 18],
        color: 'border-orange-400/20',
        labelColor: 'bg-orange-600/30'
      },
      { 
        id: 'nasal_septum', 
        name: 'NEUSTUSSENSCHOT', 
        sub: 'SEPTUM NASI', 
        top: '45%', 
        left: '50%', 
        sliceRange: [10, 22],
        color: 'border-white/30',
        labelColor: 'bg-white/20'
      },
      { 
        id: 'masseter_l', 
        name: 'KAUWSPIER (L)', 
        sub: 'M. MASSETER', 
        top: '60%', 
        left: '78%', 
        sliceRange: [15, 25],
        color: 'border-purple-400/20',
        labelColor: 'bg-purple-600/30'
      },
      { 
        id: 'masseter_r', 
        name: 'KAUWSPIER (R)', 
        sub: 'M. MASSETER', 
        top: '60%', 
        left: '22%', 
        sliceRange: [15, 25],
        color: 'border-purple-400/20',
        labelColor: 'bg-purple-600/30'
      },
      { 
        id: 'ear_canal_r', 
        name: 'GEHOORGANG (R)', 
        sub: 'MEATUS ACUSTICUS', 
        top: '38%', 
        left: '18%', 
        sliceRange: [22, 30],
        color: 'border-blue-400/20',
        labelColor: 'bg-blue-600/30'
      },
      { 
        id: 'vertebra_c2', 
        name: 'HALSWERVEL (C2)', 
        sub: 'AXIS', 
        top: '80%', 
        left: '50%', 
        sliceRange: [28, 34],
        color: 'border-green-400/20',
        labelColor: 'bg-green-600/30'
      },
      { 
        id: 'carotis_l', 
        name: 'SLAGADER (L)', 
        sub: 'A. CAROTIS INT.', 
        top: '62%', 
        left: '60%', 
        sliceRange: [20, 32],
        color: 'border-red-400/40',
        labelColor: 'bg-red-800/40'
      },
      { 
        id: 'carotis_r', 
        name: 'SLAGADER (R)', 
        sub: 'A. CAROTIS INT.', 
        top: '62%', 
        left: '38%', 
        sliceRange: [20, 32],
        color: 'border-red-400/40',
        labelColor: 'bg-red-800/40'
      },
      { 
        id: 'hard_palate', 
        name: 'VERHEMELTE', 
        sub: 'PALATUM DURUM', 
        top: '55%', 
        left: '50%', 
        sliceRange: [8, 16],
        color: 'border-yellow-400/20',
        labelColor: 'bg-yellow-600/30'
      }
    ]
  };

  const isScanAvailable = currentScan && currentScanFiles.length > 0;

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <Link 
              to="/boeken/koester-het-leven-de-weg-ernaartoe" 
              className="inline-flex items-center text-earth-gold hover:text-white transition-colors mb-4 group"
            >
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Terug naar het boek
            </Link>
            <h1 className="text-4xl font-serif font-bold tracking-tight">MRI-Scan Analyse</h1>
            <p className="text-gray-400 mt-2">Dossier: Paul van Geenen — Beeldvormend onderzoek</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-sm">
              <p className="font-bold text-red-100">Medische Vertrouwelijkheid</p>
              <p className="text-gray-400">Deze beelden zijn authentiek en maken deel uit van dit levensverhaal.</p>
            </div>
          </div>
        </div>

        {/* Viewer Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Viewer */}
          <div className="lg:col-span-3">
            <div className="relative aspect-square bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* Overlay Info */}
              {!isReport && isScanAvailable && (
                <>
                  <div className="absolute top-6 left-6 z-10 pointer-events-none">
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`} />
                      <span className="text-xs font-mono">{isLoading ? 'LOAD_ACTIVE' : 'IMG_READY'}</span>
                    </div>
                  </div>

                  <div className="absolute top-6 right-6 z-10 pointer-events-none text-right">
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Current Layer</div>
                    <div className="text-xl font-mono text-earth-gold">#{currentSlice + 1} / {currentScanFiles.length}</div>
                  </div>
                </>
              )}

              {/* Report State */}
              {isReport && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] p-12 overflow-y-auto z-30">
                  <div className="max-w-2xl text-left bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-md">
                    <div className="flex items-center gap-3 mb-6 text-earth-gold">
                      <h3 className="text-xl font-serif font-bold">Medische Rapportage</h3>
                    </div>
                    <div className="prose prose-invert prose-sm">
                      <div className="text-gray-300 leading-relaxed font-serif text-lg italic space-y-6">
                        {reportContent?.split('\n\n').map((paragraph, i) => (
                          <p key={i} className={paragraph.startsWith('Begrijpelijke uitleg:') ? 'not-italic font-sans text-base bg-earth-gold/10 p-4 rounded-xl border border-earth-gold/20' : ''}>
                            {paragraph}
                          </p>
                        ))}
                      </div>
                      <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-mono text-gray-500 uppercase">Referentie</p>
                          <p className="text-xs font-bold">Carestream Health / SR-9921</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-mono text-gray-500 uppercase">Status</p>
                          <p className="text-xs font-bold text-green-500">DEFINITIEF</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Orientation Helpers & Tumor Marker */}
              {!isReport && isScanAvailable && (
                <div className="absolute inset-0 pointer-events-none z-10">
                  {/* Subtle Grid/Axis for Orientation */}
                  <div className="absolute inset-0 border border-white/5 opacity-20 pointer-events-none" />
                  <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5" />
                  <div className="absolute left-1/2 top-0 w-[1px] h-full bg-white/5" />

                  {/* Orientation Labels (Radiological View) */}
                  <div className="absolute top-1/2 left-4 -translate-y-1/2 flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                    <div className="text-white font-mono text-xl font-bold">R</div>
                    <div className="text-[8px] uppercase tracking-tighter">Rechts</div>
                  </div>
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                    <div className="text-white font-mono text-xl font-bold">L</div>
                    <div className="text-[8px] uppercase tracking-tighter">Links</div>
                  </div>
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30 pointer-events-none">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em]">Anterior (Voor)</div>
                  </div>
                  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-30 pointer-events-none">
                    <div className="text-[10px] font-mono uppercase tracking-[0.2em]">Posterior (Achter)</div>
                  </div>
                  
                  {/* Anatomical Hotspots */}
                  {showAnnotations && ANATOMY_HOTSPOTS[selectedScan]?.map((spot) => {
                    const isVisible = currentSlice >= spot.sliceRange[0] && currentSlice <= spot.sliceRange[1];
                    if (!isVisible) return null;

                    return (
                      <motion.div 
                        key={spot.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
                        style={{ top: spot.top, left: spot.left }}
                      >
                        {/* Hotspot indicator removed for cleaner look */}
                        <div className={`${spot.id !== 'tumor' ? 'mt-2' : ''} ${spot.labelColor} text-white text-[8px] px-2 py-0.5 rounded-sm font-bold tracking-tight shadow-lg backdrop-blur-sm whitespace-nowrap`}>
                          {spot.name}
                        </div>
                        <div className="mt-0.5 text-[7px] text-white/50 bg-black/40 px-1 rounded font-mono uppercase tracking-tighter">
                          {spot.sub}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Tool status indicator */}
              {!isLoading && !isReport && activeTool === 'Magnify' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-earth-gold/90 text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm flex items-center gap-2 pointer-events-none"
                >
                  <Search className="w-3 h-3" />
                  Houd je vinger of muis ingedrukt op het beeld
                </motion.div>
              )}

              {/* Cornerstone Canvas Container */}
              <div 
                ref={viewerRef}
                className="w-full h-full touch-none block"
                style={{ cursor: activeTool === 'Magnify' ? 'none' : 'crosshair' }}
              />

              {/* Empty/Missing State */}
              {!isReport && !isScanAvailable && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-8 text-center">
                  <div className="max-w-md">
                    <ShieldAlert className="w-12 h-12 text-earth-gold mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Beelden niet beschikbaar</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Deze specifieke opname is nog niet geüpload naar de database of is niet relevant voor dit dossieronderzoek.
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoading && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="w-12 h-12 border-2 border-earth-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-sm font-mono tracking-widest text-earth-gold">RENDERING_SLICE</p>
                  </div>
                </div>
              )}

              {/* Interactive Controls Overlay */}
              {!isReport && (
                <>
                  {/* Vertical Slice Slider on left */}
                  <div 
                    onMouseDown={(e) => {
                      if (e.button === 0) handleSliderTouch(e);
                    }}
                    onMouseMove={(e) => {
                      if (e.buttons === 1) handleSliderTouch(e);
                    }}
                    onTouchStart={handleSliderTouch}
                    onTouchMove={handleSliderTouch}
                    className={`absolute left-0 top-0 bottom-0 z-20 pointer-events-auto flex flex-col items-center justify-center gap-4 bg-black/30 backdrop-blur-sm border-r border-white/10 py-8 px-4 shadow-2xl group transition-all hover:bg-black/60 touch-none cursor-ns-resize ${showSliderHint ? 'ring-2 ring-earth-gold/30 animate-pulse' : ''}`}
                  >
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-earth-gold text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none">
                      Navigeer door lagen
                    </div>

                    {showSliderHint && (
                      <div className="absolute top-10 left-12 whitespace-nowrap bg-earth-gold/90 text-black text-[11px] font-bold px-3 py-1.5 rounded-full shadow-2xl animate-bounce z-30">
                        Navigeer door de lagen
                      </div>
                    )}

                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest rotate-[-90deg] mb-8 h-4 flex items-center whitespace-nowrap group-hover:text-earth-gold transition-colors">
                      TOP SLICE
                    </div>
                    <div className="relative h-2/3 w-8 flex items-center justify-center">
                      <input 
                        type="range"
                        min="0"
                        max={Math.max(0, currentScanFiles.length - 1)}
                        value={currentSlice}
                        onChange={handleSliceChange}
                        className="absolute w-64 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-earth-gold origin-center rotate-[-90deg] touch-none pointer-events-none"
                        style={{ 
                          outline: 'none',
                          width: 'calc(100% * 10)', // This is a hack for rotated width in flex container
                          maxWidth: '400px'
                        }}
                      />
                    </div>
                    <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest rotate-[-90deg] mt-8 h-4 flex items-center whitespace-nowrap">
                      BASE SLICE
                    </div>
                    <div className="mt-4 text-earth-gold p-2 bg-earth-gold/10 rounded-full border border-earth-gold/20">
                      <Layers className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Bottom Tool Menu */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                    <div className="flex gap-2 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-xl pointer-events-auto">
                      <button 
                        onClick={() => setShowAnnotations(!showAnnotations)}
                        className={`rounded-lg p-3 transition-all duration-300 ${showAnnotations ? 'bg-earth-gold text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'text-gray-400 hover:bg-white/10'}`}
                        title="Anatoom Overlay"
                      >
                        <Layers className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleReset}
                        className="rounded-lg p-3 hover:bg-white/10 transition-colors text-gray-400"
                        title="Reset"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar / Context */}
          <div className="lg:col-span-1 space-y-6">
            {!isReport && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6"
              >
                <h3 className="text-lg font-serif font-bold mb-4 flex items-center gap-2 text-earth-gold">
                  Beeldinstellingen
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-gray-500 uppercase mb-2">
                      <span>Helderheid (Lvl)</span>
                      <span>{viewport?.voi?.windowCenter?.toFixed(0) || '0'}</span>
                    </div>
                    <input 
                      type="range"
                      min="-200"
                      max="1000"
                      value={viewport?.voi?.windowCenter || 0}
                      onChange={(e) => handleVOIChange('center', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-earth-gold"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-gray-500 uppercase mb-2">
                      <span>Contrast (Width)</span>
                      <span>{viewport?.voi?.windowWidth?.toFixed(0) || '0'}</span>
                    </div>
                    <input 
                      type="range"
                      min="1"
                      max="2000"
                      value={viewport?.voi?.windowWidth || 400}
                      onChange={(e) => handleVOIChange('width', parseInt(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-earth-gold"
                    />
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <p className="text-[9px] text-gray-500 leading-tight italic">
                      Tip: Je kunt ook direct in de afbeelding slepen met je vinger of muis als het zonnetje aan staat.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                Beschikbare Opnames
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.keys(scans).map((scanId) => {
                  const scan = scans[scanId];
                  const hasFiles = scan.files && scan.files.length > 0;
                  const isSR = scanId === 'SE000014';
                  
                  // Double check hide empty scans
                  if (!hasFiles && !isSR) return null;
                  
                  return (
                    <button
                      key={scanId}
                      onClick={() => handleScanSwitch(scanId)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-300 ${
                        selectedScan === scanId 
                          ? 'bg-earth-gold/10 border-earth-gold text-white shadow-[0_0_15px_rgba(234,179,8,0.1)]' 
                          : 'bg-white/5 border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                      } ${!hasFiles && !isSR ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-1">{scan.series}</div>
                        {hasFiles || isSR ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        )}
                      </div>
                      <div className="text-xs font-bold truncate" title={scan.name}>{scan.name}</div>
                      <div className="text-[10px] mt-1 opacity-60">
                        {isSR ? 'Rapport' : `${scan.files.length} beelden`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-serif font-bold mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-earth-gold rounded-full" />
                Uitleg van dit beeld
              </h3>
              <p 
                className="text-sm text-gray-400 leading-relaxed italic cursor-help"
                title={SCAN_EXPLANATIONS[selectedScan] || "Deze opname toont een specifiek gedeelte van de anatomie om een volledig beeld van de situatie te krijgen."}
              >
                {SCAN_EXPLANATIONS[selectedScan] || "Deze opname toont een specifiek gedeelte van de anatomie om een volledig beeld van de situatie te krijgen."}
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6"
            >
              <h3 className="text-lg font-serif font-bold mb-6 text-white">Interactiviteit</h3>
              <ul className="space-y-8">
                <li className="flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-earth-gold/20">
                    <span className="text-xs text-white/70 font-bold">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Scroll door de lagen</p>
                    <p className="text-xs text-gray-400 leading-relaxed">Gebruik de slider om door de verschillende dieptes van je scan te navigeren.</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors group-hover:bg-earth-gold/20">
                    <span className="text-xs text-white/70 font-bold">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Detail analyse</p>
                    <p className="text-xs text-gray-400 leading-relaxed">Kijk naar de asymmetrie die de aanwezigheid van je tumor verraadt.</p>
                  </div>
                </li>
              </ul>
            </motion.div>

            <div className="px-6">
               <p className="text-[10px] text-gray-600 uppercase tracking-[0.2em] font-mono">Archive No. PVG-1965-BRAIN</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
