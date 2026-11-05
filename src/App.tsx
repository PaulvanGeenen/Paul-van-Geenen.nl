import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { AnalyticsTracker } from './components/AnalyticsTracker';

// Error Boundary Component
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <h2 className="text-2xl font-serif text-earth-dark mb-4">Oeps! Er ging iets mis.</h2>
          <p className="text-earth-warm mb-8">De pagina kon niet worden geladen. Probeer de browser te verversen.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">Verversen</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load page components
const Home = lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Books = lazy(() => import('./pages/Books').then(module => ({ default: module.Books })));
const BookDetail = lazy(() => import('./pages/BookDetail').then(module => ({ default: module.BookDetail })));
const About = lazy(() => import('./pages/About').then(module => ({ default: module.About })));
const Contact = lazy(() => import('./pages/Contact').then(module => ({ default: module.Contact })));
const Echo = lazy(() => import('./pages/Echo').then(module => ({ default: module.Echo })));
const Fragments = lazy(() => import('./pages/Fragments').then(module => ({ default: module.Fragments })));
const MRIScan = lazy(() => import('./pages/MRIScan').then(module => ({ default: module.MRIScan })));
const Admin = lazy(() => import('./pages/Admin').then(module => ({ default: module.Admin })));
const Music = lazy(() => import('./pages/Music').then(module => ({ default: module.Music })));
const QRRedirect = lazy(() => import('./pages/QRRedirect').then(module => ({ default: module.QRRedirect })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

import { AudioProvider } from './context/AudioContext';
import { LionBooksIntro } from './components/ui/LionBooksIntro';

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-12 h-12 border-4 border-earth-clay/20 border-t-earth-clay rounded-full animate-spin" />
    </div>
  );
}

interface LayoutWrapperProps {
  children: ReactNode;
}

function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { pathname } = useLocation();
  
  // Clean QR redirects have no navbar or footer.
  // Identified if path starts with redirect patterns (/qr/, /qrcode/, /scan/)
  // or is a dynamic second-slash identifier that is not an existing site page.
  const isRedirectPage = 
    pathname.toLowerCase().startsWith('/music') ||
    pathname.startsWith('/qr/') || 
    pathname.startsWith('/qrcode/') || 
    pathname.startsWith('/scan/') ||
    (pathname !== '/' && 
     !['/boeken', '/de-echo', '/fragmenten', '/over-mij', '/contact', '/mri-scan', '/beheer'].some(p => pathname.toLowerCase().startsWith(p)));

  if (isRedirectPage) {
    return (
      <main className="flex-grow">
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow pt-16 md:pt-20">
        {children}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AudioProvider>
      <Router>
        <LionBooksIntro />
        <ScrollToTop />
        <AnalyticsTracker />
        <LayoutWrapper>
          <ErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/boeken" element={<Books />} />
                <Route path="/boeken/:slug" element={<BookDetail />} />
                <Route path="/de-echo" element={<Echo />} />
                <Route path="/fragmenten" element={<Fragments />} />
                <Route path="/over-mij" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/mri-scan" element={<MRIScan />} />
                <Route path="/beheer" element={<Admin />} />
                <Route path="/music" element={<Music />} />
                <Route path="/music/*" element={<Music />} />
                <Route path="/@music" element={<Music />} />
                <Route path="/@music/*" element={<Music />} />
                <Route path="/:qrCode" element={<QRRedirect />} />
                <Route path="/qr/:qrCode" element={<QRRedirect />} />
                <Route path="/qrcode/:qrCode" element={<QRRedirect />} />
                <Route path="/scan/:qrCode" element={<QRRedirect />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </LayoutWrapper>
      </Router>
    </AudioProvider>
  );
}

