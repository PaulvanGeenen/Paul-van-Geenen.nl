import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderPlus,
  File,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  Archive,
  Upload,
  Download,
  Trash2,
  Search,
  Grid,
  List as ListIcon,
  ChevronRight,
  Check,
  CheckSquare,
  Square,
  X,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Lock,
  Shield,
  Copy
} from 'lucide-react';

export interface StorageItem {
  name: string;
  path: string;
  isDir: boolean;
  isProtected?: boolean;
  type: 'folder' | 'image' | 'document' | 'audio' | 'video' | 'archive' | 'other';
  extension: string;
  size: number;
  sizeFormatted: string;
  modified: string;
  modifiedFormatted: string;
  url: string | null;
  itemCount?: number;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface FileManagerProps {
  mode?: 'manager' | 'picker';
  multiSelect?: boolean;
  initialSelectedUrls?: string[];
  onSelect?: (items: StorageItem[]) => void;
  onClose?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  mode = 'manager',
  multiSelect = true,
  onSelect,
  onClose,
}) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([{ name: 'Hoofdmap', path: '' }]);
  const [folders, setFolders] = useState<StorageItem[]>([]);
  const [files, setFiles] = useState<StorageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [selectedItems, setSelectedItems] = useState<StorageItem[]>([]);

  const [isNewFolderOpen, setIsNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isDeletingItem, setIsDeletingItem] = useState<StorageItem | null>(null);
  const [previewImage, setPreviewImage] = useState<StorageItem | null>(null);
  const [copiedUrlPath, setCopiedUrlPath] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fetchDirectory = async (path: string = currentPath) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/files.php?action=list&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        setFolders(data.folders || []);
        setFiles(data.files || []);
        setCurrentPath(data.currentPath || '');
        setBreadcrumbs(data.breadcrumbs || [{ name: 'Hoofdmap', path: '' }]);
      } else {
        setUploadFeedback({ type: 'error', text: data.error || 'Kon map niet laden.' });
      }
    } catch {
      setUploadFeedback({ type: 'error', text: 'Netwerkfout bij laden van bestanden.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory('');
  }, []);

  const handleNavigate = (path: string) => {
    setUploadFeedback(null);
    setCurrentPath(path);
    fetchDirectory(path);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const formData = new FormData();
      formData.append('action', 'mkdir');
      formData.append('path', currentPath);
      formData.append('name', newFolderName.trim());

      const res = await fetch('/api/files.php', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setNewFolderName('');
        setIsNewFolderOpen(false);
        fetchDirectory(currentPath);
        setUploadFeedback({ type: 'success', text: `Map "${data.name}" aangemaakt!` });
      } else {
        setUploadFeedback({ type: 'error', text: data.error || 'Map aanmaken mislukt.' });
      }
    } catch {
      setUploadFeedback({ type: 'error', text: 'Netwerkfout bij aanmaken map.' });
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('path', currentPath);

    for (let i = 0; i < fileList.length; i++) {
      formData.append('files[]', fileList[i]);
    }

    try {
      const res = await fetch('/api/files.php', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.uploaded?.length || 0;
        setUploadFeedback({
          type: 'success',
          text: `${count} bestand(en) succesvol geüpload naar deze map (wordt bij elke deploy/sync automatisch meegepusht naar Git)!`,
        });
        fetchDirectory(currentPath);
      } else {
        const errs = data.errors?.join(' ') || data.error || 'Uploaden mislukt.';
        setUploadFeedback({ type: 'error', text: errs });
      }
    } catch {
      setUploadFeedback({ type: 'error', text: 'Netwerkfout tijdens uploaden.' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!isDeletingItem) return;
    try {
      const formData = new FormData();
      formData.append('action', 'delete');
      formData.append('path', isDeletingItem.path);

      const res = await fetch('/api/files.php', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadFeedback({ type: 'success', text: `"${isDeletingItem.name}" verwijderd!` });
        setIsDeletingItem(null);
        fetchDirectory(currentPath);
      } else {
        setUploadFeedback({ type: 'error', text: data.error || 'Verwijderen mislukt.' });
      }
    } catch {
      setUploadFeedback({ type: 'error', text: 'Netwerkfout bij verwijderen.' });
    }
  };

  const handleCopyFileUrl = (file: StorageItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.url) return;
    navigator.clipboard.writeText(file.url);
    setCopiedUrlPath(file.path);
    setTimeout(() => setCopiedUrlPath(null), 2000);
  };

  const toggleSelect = (item: StorageItem) => {
    if (mode !== 'picker' || item.isDir) return;

    if (!multiSelect) {
      setSelectedItems([item]);
      return;
    }

    setSelectedItems((prev) => {
      const exists = prev.some((p) => p.path === item.path);
      if (exists) {
        return prev.filter((p) => p.path !== item.path);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleConfirmPicker = () => {
    if (onSelect) {
      onSelect(selectedItems);
    }
  };

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (mode === 'picker') {
      return matchesSearch && f.type === 'image';
    }
    return matchesSearch;
  });

  const getItemIcon = (item: StorageItem) => {
    switch (item.type) {
      case 'folder':
        return <Folder className="text-earth-gold w-6 h-6 shrink-0" />;
      case 'image':
        return <ImageIcon className="text-amber-400 w-5 h-5 shrink-0" />;
      case 'document':
        return <FileText className="text-blue-400 w-5 h-5 shrink-0" />;
      case 'audio':
        return <Music className="text-purple-400 w-5 h-5 shrink-0" />;
      case 'video':
        return <Video className="text-pink-400 w-5 h-5 shrink-0" />;
      case 'archive':
        return <Archive className="text-emerald-400 w-5 h-5 shrink-0" />;
      default:
        return <File className="text-zinc-400 w-5 h-5 shrink-0" />;
    }
  };

  return (
    <div className={`flex flex-col bg-[#161412] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative ${mode === 'picker' ? 'max-h-[85vh]' : 'min-h-[580px]'}`}>
      {/* Header Bar */}
      <div className="p-5 border-b border-white/10 bg-black/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-earth-gold/15 text-earth-gold border border-earth-gold/25 rounded-xl">
            <HardDrive size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-base tracking-wide font-serif">
                {mode === 'picker' ? "Kies Foto('s) uit Mediabibliotheek" : 'Bestandsbeheer & Mediabibliotheek'}
              </h3>
              {mode === 'picker' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-earth-gold/20 text-earth-gold font-bold">
                  {multiSelect ? 'Meerdere mogelijk' : '1 selecteren'}
                </span>
              )}
            </div>
            <p className="text-xs text-earth-light/65 mt-0.5">
              {mode === 'picker'
                ? "Klik op foto's om ze toe te voegen aan je social media bericht"
                : "Upload foto's, maak mappen aan en beheer promotiemateriaal (wordt automatisch gesynchroniseerd en naar Git gepusht)."}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewFolderOpen(true)}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <FolderPlus size={15} className="text-earth-gold" />
            <span>Nieuwe map</span>
          </button>

          <label className="px-3.5 py-2 bg-earth-gold hover:bg-amber-400 text-black font-extrabold text-xs font-mono rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-md">
            <Upload size={15} />
            <span>{isUploading ? 'Uploaden...' : 'Upload bestanden'}</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUploadFiles(e.target.files)}
              disabled={isUploading}
            />
          </label>

          <button
            type="button"
            onClick={() => fetchDirectory(currentPath)}
            disabled={isLoading}
            className="p-2 text-earth-light/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-colors cursor-pointer"
            title="Vernieuwen"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {mode === 'picker' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-earth-light/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl transition-colors ml-2 cursor-pointer"
              title="Sluiten"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Breadcrumbs & Search / View Switcher */}
      <div className="p-4 bg-black/25 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight size={13} className="text-white/30 shrink-0" />}
              <button
                type="button"
                onClick={() => handleNavigate(crumb.path)}
                className={`px-2 py-1 rounded-lg transition-colors truncate max-w-[160px] cursor-pointer ${
                  idx === breadcrumbs.length - 1
                    ? 'text-earth-gold font-bold bg-earth-gold/15'
                    : 'text-earth-light/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-white/40" />
            <input
              type="text"
              placeholder="Zoek bestand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-earth-gold w-36 sm:w-48"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-white/40 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center bg-black/40 border border-white/15 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white/15 text-earth-gold' : 'text-white/50 hover:text-white'}`}
              title="Tegels"
            >
              <Grid size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white/15 text-earth-gold' : 'text-white/50 hover:text-white'}`}
              title="Lijst"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Systeembescherming Alert */}
      <div className="px-5 py-3 bg-black/20 border-b border-white/10 flex items-center gap-3 text-xs">
        <Shield size={16} className="text-earth-gold shrink-0" />
        <span className="text-earth-light/70 font-sans text-[11px] leading-relaxed">
          <strong className="text-white">Afgeschermde opslag &amp; Git-synchronisatie:</strong> Alle mappen en foto&apos;s in <code className="text-earth-gold">/storage/</code> staan los van de websitecode en worden automatisch teruggesynchroniseerd en meegepusht naar GitHub.
        </span>
      </div>

      {/* Upload & Info Banners */}
      {uploadFeedback && (
        <div
          className={`px-5 py-3 border-b text-xs flex items-center justify-between gap-3 ${
            uploadFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
              : 'bg-red-500/10 border-red-500/25 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{uploadFeedback.text}</span>
          </div>
          <button type="button" onClick={() => setUploadFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Drag & Drop Canvas */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleUploadFiles(e.dataTransfer.files);
        }}
        className={`flex-1 p-5 overflow-y-auto relative ${isDragging ? 'bg-earth-gold/5 border-2 border-dashed border-earth-gold' : ''}`}
      >
        {isDragging && (
          <div className="absolute inset-0 z-20 bg-black/85 flex flex-col items-center justify-center pointer-events-none text-earth-gold gap-3">
            <Upload size={48} className="animate-bounce" />
            <p className="font-mono text-sm font-bold uppercase tracking-wider">Laat los om bestanden te uploaden naar deze map</p>
          </div>
        )}

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center text-white/50 gap-3">
            <RefreshCw size={24} className="animate-spin text-earth-gold" />
            <span className="font-mono text-xs">Bestanden laden...</span>
          </div>
        ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-white/40 gap-3 border-2 border-dashed border-white/10 rounded-3xl">
            <Folder size={40} className="stroke-[1.2] opacity-40" />
            <p className="font-mono text-xs">Deze map is leeg.</p>
            <p className="text-[11px] text-white/50">Sleep bestanden hierheen of klik op &apos;Upload bestanden&apos; hierboven.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Mappen Sectie */}
            {filteredFolders.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-earth-light/50 font-bold">
                  Mappen ({filteredFolders.length})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filteredFolders.map((folder) => (
                    <div
                      key={folder.path}
                      onClick={() => handleNavigate(folder.path)}
                      className="group p-3.5 bg-black/35 hover:bg-black/55 border border-white/10 hover:border-earth-gold/40 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 relative"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Folder className="w-5 h-5 text-earth-gold group-hover:scale-110 transition-transform shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-white truncate font-sans">{folder.name}</p>
                          <p className="text-[10px] text-white/45 font-mono mt-0.5">
                            {folder.itemCount !== undefined ? `${folder.itemCount} items` : 'Map'}
                          </p>
                        </div>
                      </div>

                      {mode === 'manager' && (
                        folder.isProtected ? (
                          <div className="p-1.5 text-white/35" title="Beveiligde hoofdmap (kan niet worden verwijderd)">
                            <Lock size={13} />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDeletingItem(folder);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-white/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                            title="Map verwijderen"
                          >
                            <Trash2 size={13} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bestanden Sectie */}
            {filteredFiles.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[11px] font-mono uppercase tracking-wider text-earth-light/50 font-bold">
                  Bestanden ({filteredFiles.length})
                </h4>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedItems.some((s) => s.path === file.path);
                      return (
                        <div
                          key={file.path}
                          onClick={() => {
                            if (mode === 'picker') {
                              toggleSelect(file);
                            } else if (file.type === 'image') {
                              setPreviewImage(file);
                            }
                          }}
                          className={`group bg-black/35 border rounded-2xl overflow-hidden transition-all flex flex-col justify-between relative cursor-pointer ${
                            isSelected
                              ? 'border-earth-gold ring-2 ring-earth-gold/40 bg-earth-gold/5'
                              : 'border-white/10 hover:border-white/25 hover:bg-black/50'
                          }`}
                        >
                          <div className="aspect-square w-full bg-black/60 relative overflow-hidden flex items-center justify-center">
                            {file.type === 'image' && file.url ? (
                              <img
                                src={file.url}
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : (
                              <div className="p-4 flex flex-col items-center gap-1 text-white/50">
                                {getItemIcon(file)}
                                <span className="text-[10px] font-mono uppercase text-white/60 font-bold">
                                  {file.extension}
                                </span>
                              </div>
                            )}

                            {mode === 'picker' && (
                              <div className="absolute top-2 left-2 z-10">
                                {isSelected ? (
                                  <div className="w-6 h-6 rounded-lg bg-earth-gold text-black flex items-center justify-center shadow-lg font-bold">
                                    <Check size={14} className="stroke-[3]" />
                                  </div>
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-black/60 border border-white/30 hover:border-white flex items-center justify-center text-white/50" />
                                )}
                              </div>
                            )}

                            {mode === 'manager' && (
                              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                {file.type === 'image' && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImage(file);
                                    }}
                                    className="p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
                                    title="Bekijken"
                                  >
                                    <Eye size={14} />
                                  </button>
                                )}
                                {file.url && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyFileUrl(file, e)}
                                    className="p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
                                    title="Kopieer URL"
                                  >
                                    {copiedUrlPath === file.path ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                  </button>
                                )}
                                <a
                                  href={`/api/files.php?action=download&path=${encodeURIComponent(file.path)}`}
                                  download
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-2 bg-earth-gold hover:bg-amber-400 text-black rounded-xl transition-colors"
                                  title="Downloaden"
                                >
                                  <Download size={14} />
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeletingItem(file);
                                  }}
                                  className="p-2 bg-white/15 hover:bg-red-500/25 text-white hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                                  title="Verwijderen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="p-2.5">
                            <p className="text-xs text-white/90 truncate font-sans font-medium" title={file.name}>
                              {file.name}
                            </p>
                            <div className="flex justify-between items-center text-[10px] text-white/45 font-mono mt-1">
                              <span>{file.sizeFormatted}</span>
                              <span>{file.extension.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-black/35 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/10">
                    {filteredFiles.map((file) => {
                      const isSelected = selectedItems.some((s) => s.path === file.path);
                      return (
                        <div
                          key={file.path}
                          onClick={() => {
                            if (mode === 'picker') toggleSelect(file);
                          }}
                          className={`p-3.5 flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                            isSelected ? 'bg-earth-gold/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {mode === 'picker' && (
                              <div className="shrink-0">
                                {isSelected ? (
                                  <CheckSquare size={18} className="text-earth-gold" />
                                ) : (
                                  <Square size={18} className="text-white/30" />
                                )}
                              </div>
                            )}
                            <div className="w-9 h-9 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                              {file.type === 'image' && file.url ? (
                                <img src={file.url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                getItemIcon(file)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-white truncate font-sans font-medium">{file.name}</p>
                              <p className="text-[10px] text-white/45 font-mono">{file.modifiedFormatted}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-xs font-mono text-white/60 shrink-0">
                            <span>{file.sizeFormatted}</span>

                            {mode === 'manager' && (
                              <div className="flex items-center gap-1.5">
                                {file.url && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleCopyFileUrl(file, e)}
                                    className="p-1.5 text-white/60 hover:text-earth-gold hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                                    title="Kopieer URL"
                                  >
                                    {copiedUrlPath === file.path ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                  </button>
                                )}
                                <a
                                  href={`/api/files.php?action=download&path=${encodeURIComponent(file.path)}`}
                                  download
                                  className="p-1.5 text-white/60 hover:text-earth-gold hover:bg-white/10 rounded-lg transition-colors"
                                  title="Downloaden"
                                >
                                  <Download size={14} />
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeletingItem(file);
                                  }}
                                  className="p-1.5 text-white/60 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Verwijderen"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Picker Bottom Action Bar */}
      {mode === 'picker' && (
        <div className="p-4 border-t border-white/10 bg-black/50 flex items-center justify-between gap-4">
          <div className="text-xs font-mono text-white/60">
            <span className="text-earth-gold font-bold">{selectedItems.length}</span> foto(&apos;s) geselecteerd
          </div>
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-mono text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Annuleren
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirmPicker}
              disabled={selectedItems.length === 0}
              className="px-6 py-2.5 bg-earth-gold hover:bg-amber-400 disabled:opacity-40 text-black font-extrabold text-xs font-mono uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
            >
              <Check size={14} />
              <span>Gebruik in bericht ({selectedItems.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Nieuwe Map */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181614] border border-white/15 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <FolderPlus size={16} className="text-earth-gold" /> Nieuwe Map Aanmaken
              </h4>
              <button type="button" onClick={() => setIsNewFolderOpen(false)} className="text-white/50 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-white/60 mb-1">Naam van de map:</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Bijv. De Geboorte van de Leeuw Promo"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-earth-gold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-4 py-2 text-xs font-mono text-white/60 hover:text-white rounded-xl cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 bg-earth-gold hover:bg-amber-400 disabled:opacity-40 text-black font-extrabold text-xs font-mono rounded-xl uppercase tracking-wider transition-all cursor-pointer"
                >
                  Aanmaken
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Bevestig Verwijderen */}
      {isDeletingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#181614] border border-red-500/30 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-500/15 rounded-xl border border-red-500/20">
                <Trash2 size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white font-mono">Item Verwijderen?</h4>
                <p className="text-[11px] text-white/50 font-mono mt-0.5">Weet je dit zeker?</p>
              </div>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Weet je zeker dat je <strong className="text-white">&ldquo;{isDeletingItem.name}&rdquo;</strong> wilt verwijderen?{' '}
              {isDeletingItem.isDir && 'Alle bestanden in deze map worden ook definitief verwijderd.'}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeletingItem(null)}
                className="px-4 py-2 text-xs font-mono text-white/60 hover:text-white rounded-xl cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs font-mono rounded-xl uppercase tracking-wider transition-all cursor-pointer"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX: Foto Voorvertoning */}
      {previewImage && previewImage.url && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1 font-mono text-xs cursor-pointer"
            >
              <X size={18} /> Sluiten
            </button>
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl border border-white/15 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-3 text-center text-xs font-mono text-white/60">
              <p className="text-white font-bold">{previewImage.name}</p>
              <p>{previewImage.sizeFormatted} • {previewImage.modifiedFormatted}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
