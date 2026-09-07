import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Search, GraduationCap, MessageSquare, Calendar, Phone,
  Plus, Edit, Trash2, X, Settings, ChevronRight, ChevronLeft, ArrowRight,
  CheckCircle2, AlertCircle, Bookmark, Layers, Home, Info, Eye,
  ThumbsUp, Heart, ExternalLink, Download, Video,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { RichTextEditor } from './components/RichTextEditor';
import { sanitizeRichText, isRichTextEmpty, stripHtml, linkifyHtml } from './lib/sanitize';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80';

// ── Utilities ────────────────────────────────────────────────────────────────

const compressImageToBlob = (file, maxW = 1200, maxH = 1200, quality = 0.8) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > h ? w > maxW : h > maxH) {
          if (w > h) { h = Math.round(h * maxW / w); w = maxW; }
          else        { w = Math.round(w * maxH / h); h = maxH; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

const uploadImage = async (file, folder) => {
  const blob = await compressImageToBlob(file);
  const path = `${folder}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('site-images')
    .upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl;
};

// Parameterised simulated-engagement helper (replaces three near-identical functions)
const getSimulatedStat = (item, field, base, spread) => {
  const real = item[field] || 0;
  const seed = String(item.id || '123')
    .split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return base + (seed % spread) + real;
};

// Map a DB row (snake_case) to the JS object shape (camelCase) used in state
const mapDbItem = (row) => ({
  id:          row.id,
  title:       row.title,
  description: row.description,
  mainContent: row.main_content,
  imageUrl:    row.image_url,
  videoUrl:    row.video_url,
  downloadUrl: row.download_url,
  sectionId:   row.section_id,
  views:       row.views,
  likes:       row.likes,
  hearts:      row.hearts,
});

// ── FormattedTextWithLinks ───────────────────────────────────────────────────

// Renders sanitized rich-text HTML (bold/italic/underline/lists/alignment/
// direction) and auto-links any bare URL left as plain text within it.
const FormattedTextWithLinks = ({ html, className, as: Tag = 'div' }) => {
  if (!html) return null;
  return (
    <Tag
      className={`rich-content ${className || ''}`}
      onClick={(e) => { if (e.target.closest('a')) e.stopPropagation(); }}
      dangerouslySetInnerHTML={{ __html: linkifyHtml(html) }}
    />
  );
};

// ── ContentModal ─────────────────────────────────────────────────────────────

const ContentModal = ({ isOpen, onClose, onSave, initialContent, sectionName, isSaving }) => {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [mainContent, setMainContent] = useState('');
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [videoUrl, setVideoUrl]       = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [notification, setNotification] = useState(null);
  const objectUrlRef = useRef(null);

  // Forces the three RichTextEditor instances to remount (fresh TipTap state)
  // whenever the modal opens for a different item, instead of fighting their
  // internal editor state with a controlled-value sync on every keystroke.
  const editorKey = isOpen ? (initialContent?.id || 'new') : 'closed';

  useEffect(() => {
    if (!isOpen) return;
    setTitle(initialContent?.title || '');
    setDescription(initialContent?.description || '');
    setMainContent(initialContent?.mainContent || '');
    setImageFile(null);
    setImagePreviewUrl(initialContent?.imageUrl || '');
    setVideoUrl(initialContent?.videoUrl || '');
    setDownloadUrl(initialContent?.downloadUrl || '');
    setNotification(null);
  }, [isOpen, initialContent]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageFile(file);
    setImagePreviewUrl(url);
  };

  const handleSubmit = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (isRichTextEmpty(title) || isRichTextEmpty(description) || isRichTextEmpty(mainContent)) {
      setNotification({ type: 'error', message: 'الرجاء إدخال العنوان والموجز والمحتوى الكامل.' });
      return;
    }
    onSave({
      id:          initialContent?.id || null,
      title:       sanitizeRichText(title),
      description: sanitizeRichText(description),
      mainContent: sanitizeRichText(mainContent),
      imageFile,
      imageUrl:    imageFile ? null : (imagePreviewUrl || initialContent?.imageUrl || null),
      videoUrl,
      downloadUrl,
      views:       initialContent?.views  || 0,
      likes:       initialContent?.likes  || 0,
      hearts:      initialContent?.hearts || 0,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-4xl rtl flex flex-col max-h-[92vh] border border-slate-100">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-3 h-8 bg-indigo-600 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-900">
              {initialContent ? 'تعديل محتوى' : 'نشر محتوى جديد'} في <span className="text-indigo-600">{sectionName}</span>
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
            <X size={22} />
          </button>
        </div>

        {notification && (
          <div className={`mb-4 p-4 rounded-xl flex items-center space-x-2 space-x-reverse text-sm font-bold ${notification.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
            {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="flex-grow overflow-y-auto pr-2 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-700 text-sm font-bold mb-2">العنوان:</label>
              <RichTextEditor key={`title-${editorKey}`} value={title} onChange={setTitle}
                placeholder="اكتب عنواناً جذاباً ومعبراً..." minHeight="3rem" />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-bold mb-2">موجز قصير (الوصف):</label>
              <RichTextEditor key={`description-${editorKey}`} value={description} onChange={setDescription}
                placeholder="ملخص سريع يظهر في مستعرض المنشورات..." minHeight="4rem" />
            </div>
            <div>
              <label className="block text-slate-700 text-sm font-bold mb-2">المحتوى الكامل (يدعم الروابط المباشرة):</label>
              <RichTextEditor key={`main-${editorKey}`} value={mainContent} onChange={setMainContent}
                placeholder="اكتب تفاصيل المحتوى هنا..." minHeight="10rem" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2">رابط فيديو (YouTube أو رابط مباشر):</label>
                <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-800" />
              </div>
              <div>
                <label className="block text-slate-700 text-sm font-bold mb-2">رابط تحميل ملف أو فيديو:</label>
                <input type="url" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)}
                  placeholder="https://example.com/lecture.mp4 أو PDF"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-800" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-bold mb-2">صورة مرفقة:</label>
              <input type="file" accept="image/*" onChange={handleFileChange}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
              {imagePreviewUrl && (
                <div className="mt-4 text-center">
                  <img src={imagePreviewUrl} alt="معاينة" className="max-h-48 rounded-2xl shadow-md mx-auto object-cover border border-slate-200" />
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex justify-end space-x-3 space-x-reverse mt-6 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} disabled={isSaving}
            className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition">إلغاء</button>
          <button type="button" onClick={handleSubmit} disabled={isSaving}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-indigo-500/25 transition disabled:opacity-50">
            {isSaving ? 'جارِ النشر والحفظ...' : 'نشر المحتوى الآن'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── ConfirmDeleteModal ───────────────────────────────────────────────────────

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, sectionName }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-md rtl text-right border border-slate-100">
        <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 font-black text-2xl">!</div>
        <h2 className="text-xl font-black text-slate-900 mb-2">تأكيد عملية الحذف</h2>
        <p className="text-slate-600 mb-6 text-sm leading-relaxed">هل أنت متأكد من رغبتك في حذف هذا العنصر من <span className="font-bold text-slate-800">{sectionName}</span> نهائياً؟</p>
        <div className="flex justify-end space-x-3 space-x-reverse">
          <button onClick={onClose} className="px-5 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition">تراجع</button>
          <button onClick={onConfirm} className="px-6 py-3 bg-red-600 text-white font-bold rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-700 transition">تأكيد الحذف</button>
        </div>
      </div>
    </div>
  );
};

// ── ArticleReaderModal ───────────────────────────────────────────────────────

const ArticleReaderModal = ({ isOpen, onClose, article, allArticles, onSelectArticle, onEdit, onDelete, isMainAdmin, onReact }) => {
  if (!isOpen || !article) return null;

  const currentIndex = allArticles.findIndex(a => a.id === article.id);
  const prevArticle  = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextArticle  = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  const displayViews  = getSimulatedStat(article, 'views',  1240, 3500);
  const displayLikes  = getSimulatedStat(article, 'likes',   180,  450);
  const displayHearts = getSimulatedStat(article, 'hearts',   90,  280);

  const getEmbedUrl = (url) => {
    if (!url) return null;
    if (url.includes('youtube.com/watch?v='))
      return `https://www.youtube.com/embed/${url.split('watch?v=')[1]?.split('&')[0]}`;
    if (url.includes('youtu.be/'))
      return `https://www.youtube.com/embed/${url.split('youtu.be/')[1]?.split('?')[0]}`;
    return null;
  };

  const embedUrl = getEmbedUrl(article.videoUrl);

  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl rtl flex flex-col max-h-[94vh] border border-slate-100 overflow-hidden">
        <div className="flex justify-between items-center px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="w-2.5 h-6 bg-indigo-600 rounded-full"></div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">
              عنصر {currentIndex + 1} من {allArticles.length}
            </span>
            <div className="flex items-center space-x-1.5 space-x-reverse text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full font-bold">
              <Eye size={14} className="text-indigo-600 ml-1" />
              <span>{displayViews} مشاهدة</span>
            </div>
          </div>
          <div className="flex items-center space-x-2 space-x-reverse">
            {isMainAdmin && (
              <>
                <button onClick={() => { onClose(); onEdit(article); }}
                  className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition flex items-center space-x-1 space-x-reverse text-xs font-bold">
                  <Edit size={16} /><span>تعديل</span>
                </button>
                <button onClick={() => { onClose(); onDelete(article.id); }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition flex items-center space-x-1 space-x-reverse text-xs font-bold">
                  <Trash2 size={16} /><span>حذف</span>
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-6 sm:p-10 space-y-6">
          <FormattedTextWithLinks
            as="h1"
            html={article.title}
            className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight"
          />

          {article.imageUrl && (
            <div className="rounded-2xl overflow-hidden shadow-lg border border-slate-100 my-4 max-h-[420px] bg-slate-100 flex items-center justify-center">
              <img src={article.imageUrl} alt={stripHtml(article.title)} className="w-full object-cover max-h-[420px]" />
            </div>
          )}

          {article.videoUrl && (
            <div className="my-6">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Video size={18} className="text-indigo-600" /> مشغل الفيديو / المحاضرة:
              </h3>
              {embedUrl ? (
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-xl border border-slate-200 bg-black">
                  <iframe src={embedUrl} title={stripHtml(article.title)} className="w-full h-full" allowFullScreen />
                </div>
              ) : (
                <div className="p-4 bg-indigo-50 rounded-2xl flex items-center justify-between border border-indigo-100">
                  <span className="text-sm text-indigo-900 font-semibold truncate max-w-md">{article.videoUrl}</span>
                  <a href={article.videoUrl} target="_blank" rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700 transition">
                    <span>مشاهدة الفيديو</span><ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          )}

          {article.downloadUrl && (
            <div className="my-4">
              <a href={article.downloadUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition">
                <Download size={18} />
                <span>تنزيل الملف / الفيديو المرفق</span>
                <ExternalLink size={14} className="opacity-70" />
              </a>
            </div>
          )}

          <div className="p-5 bg-indigo-50/50 border-r-4 border-indigo-600 rounded-2xl text-slate-700 font-bold text-base sm:text-lg leading-relaxed">
            <FormattedTextWithLinks html={article.description} />
          </div>

          <div className="pt-4 border-t border-slate-100">
            <FormattedTextWithLinks
              html={article.mainContent}
              className="text-slate-800 leading-loose text-lg sm:text-xl font-normal"
            />
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center justify-center space-x-4 space-x-reverse">
            <button onClick={() => onReact(article, 'like')}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-2xl font-bold transition shadow-sm text-sm">
              <ThumbsUp size={18} className="text-indigo-600" />
              <span>أعجبني</span>
              <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">{displayLikes}</span>
            </button>
            <button onClick={() => onReact(article, 'heart')}
              className="flex items-center space-x-2 space-x-reverse px-5 py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-2xl font-bold transition shadow-sm text-sm">
              <Heart size={18} className="text-rose-500 fill-rose-500" />
              <span>إعجاب قلبي</span>
              <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full">{displayHearts}</span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <button onClick={() => prevArticle && onSelectArticle(prevArticle)} disabled={!prevArticle}
            className={`flex items-center px-4 py-2.5 rounded-2xl font-bold text-sm transition ${prevArticle ? 'bg-white border border-slate-200 text-slate-800 hover:bg-indigo-600 hover:text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <ChevronRight size={18} className="ml-1.5" /><span>العنصر السابق</span>
          </button>
          <button onClick={() => nextArticle && onSelectArticle(nextArticle)} disabled={!nextArticle}
            className={`flex items-center px-4 py-2.5 rounded-2xl font-bold text-sm transition ${nextArticle ? 'bg-white border border-slate-200 text-slate-800 hover:bg-indigo-600 hover:text-white shadow-sm' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
            <span>العنصر التالي</span><ChevronLeft size={18} className="mr-1.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── App ──────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'home',      name: 'الرئيسية',              icon: Home },
  { id: 'about',     name: 'حول المدونة',            icon: Info },
  { id: 'articles',  name: 'المقالات',               icon: BookOpen },
  { id: 'research',  name: 'الأبحاث',               icon: Search },
  { id: 'lectures',  name: 'المحاضرات والفيديو',     icon: GraduationCap },
  { id: 'reviews',   name: 'المراجعات',              icon: MessageSquare },
  { id: 'events',    name: 'المؤتمرات',             icon: Calendar },
  { id: 'contact',   name: 'اتصل بنا',              icon: Phone },
  { id: 'settings',  name: 'إعدادات الموقع',         icon: Settings },
];

const NO_COUNT_SECTIONS = new Set(['home', 'about', 'contact', 'settings']);
const ITEMS_PER_PAGE = 6;

const App = () => {
  // ── Auth ──────────────────────────────────────────────────
  const [session,     setSession]     = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [adminEmail,  setAdminEmail]  = useState('');
  const [adminPass,   setAdminPass]   = useState('');
  const [authError,   setAuthError]   = useState('');

  // ── Content ───────────────────────────────────────────────
  const [currentItems,   setCurrentItems]   = useState([]);
  const [sectionCounts,  setSectionCounts]  = useState({});
  const [isSaving,       setIsSaving]       = useState(false);

  // ── Cover image ───────────────────────────────────────────
  const [coverImageUrl, setCoverImageUrl] = useState(DEFAULT_COVER);
  const [coverPos,      setCoverPos]      = useState({ x: 0, y: 0 });
  const [coverScale,    setCoverScale]    = useState(1);
  const [isDragging,    setIsDragging]    = useState(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const dragInitPos  = useRef({ x: 0, y: 0 });
  const coverSaveTimer = useRef(null);

  // ── Navigation ────────────────────────────────────────────
  const [activeSectionId,  setActiveSectionId]  = useState('articles');
  const [searchQuery,      setSearchQuery]       = useState('');
  const [currentPage,      setCurrentPage]       = useState(1);
  const [selectedArticle,  setSelectedArticle]   = useState(null);

  // ── Modals ────────────────────────────────────────────────
  const [isModalOpen,       setIsModalOpen]       = useState(false);
  const [editingContent,    setEditingContent]    = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deletingContentId, setDeletingContentId] = useState(null);

  const isMainAdmin = !!session;
  const activeSectionObj  = SECTIONS.find(s => s.id === activeSectionId) || SECTIONS[2];
  const activeSectionName = activeSectionObj.name;

  // ── Derived lists ─────────────────────────────────────────
  const filteredItems = currentItems.filter(item =>
    stripHtml(item.title).toLowerCase().includes(searchQuery.toLowerCase()) ||
    stripHtml(item.description).toLowerCase().includes(searchQuery.toLowerCase()) ||
    stripHtml(item.mainContent).toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages     = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // ── Initialisation ────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      setSession(s);

      // Load site settings (cover image / position / scale)
      const { data: settings } = await supabase.from('site_settings').select('*');
      if (settings) {
        const map = Object.fromEntries(settings.map(r => [r.key, r.value]));
        if (map.cover_image_url) setCoverImageUrl(map.cover_image_url);
        if (map.cover_pos_x)    setCoverPos(p => ({ ...p, x: Number(map.cover_pos_x) }));
        if (map.cover_pos_y)    setCoverPos(p => ({ ...p, y: Number(map.cover_pos_y) }));
        if (map.cover_scale)    setCoverScale(Number(map.cover_scale));
      }

      setIsAuthReady(true);
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // ── Fetch content for the active section ──────────────────
  const fetchContent = useCallback(async (sectionId) => {
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: true });
    if (!error) setCurrentItems((data || []).map(mapDbItem));
  }, []);

  // ── Fetch sidebar counts (all section_ids, one lightweight query) ──
  const fetchCounts = useCallback(async () => {
    const { data } = await supabase.from('content_items').select('section_id');
    const counts = {};
    data?.forEach(r => { counts[r.section_id] = (counts[r.section_id] || 0) + 1; });
    setSectionCounts(counts);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    fetchContent(activeSectionId);
  }, [activeSectionId, isAuthReady, fetchContent]);

  useEffect(() => {
    if (isAuthReady) fetchCounts();
  }, [isAuthReady, fetchCounts]);

  // ── Section navigation ────────────────────────────────────
  const handleSectionClick = (id) => {
    setActiveSectionId(id);
    setSearchQuery('');
    setCurrentPage(1);
  };

  // ── Cover image ───────────────────────────────────────────
  const persistCoverSettings = useCallback(async (url, pos, scale) => {
    if (!isMainAdmin) return;
    await supabase.from('site_settings').upsert([
      { key: 'cover_image_url', value: url },
      { key: 'cover_pos_x',    value: String(pos.x) },
      { key: 'cover_pos_y',    value: String(pos.y) },
      { key: 'cover_scale',    value: String(scale) },
    ]);
  }, [isMainAdmin]);

  const scheduleCoverSave = useCallback((url, pos, scale) => {
    if (!isMainAdmin) return;
    if (coverSaveTimer.current) clearTimeout(coverSaveTimer.current);
    coverSaveTimer.current = setTimeout(() => persistCoverSettings(url, pos, scale), 900);
  }, [isMainAdmin, persistCoverSettings]);

  const handleCoverImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !isMainAdmin) return;
    try {
      const url = await uploadImage(file, 'covers');
      setCoverImageUrl(url);
      await persistCoverSettings(url, coverPos, coverScale);
    } catch (err) {
      console.error('Cover upload error:', err);
    }
  };

  const handleCoverMouseDown = (e) => {
    if (!isMainAdmin) return;
    setIsDragging(true);
    dragStart.current  = { x: e.clientX, y: e.clientY };
    dragInitPos.current = { ...coverPos };
  };

  const handleCoverMouseMove = (e) => {
    if (!isDragging) return;
    setCoverPos({
      x: dragInitPos.current.x + e.clientX - dragStart.current.x,
      y: dragInitPos.current.y + e.clientY - dragStart.current.y,
    });
  };

  const handleCoverMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    scheduleCoverSave(coverImageUrl, coverPos, coverScale);
  };

  const handleCoverWheel = (e) => {
    if (!isMainAdmin) return;
    e.preventDefault();
    const newScale = Math.min(3, Math.max(0.5, coverScale + (e.deltaY < 0 ? 0.1 : -0.1)));
    setCoverScale(newScale);
    scheduleCoverSave(coverImageUrl, coverPos, newScale);
  };

  const resetCoverTransform = () => {
    setCoverPos({ x: 0, y: 0 });
    setCoverScale(1);
    scheduleCoverSave(coverImageUrl, { x: 0, y: 0 }, 1);
  };

  // ── Content CRUD ──────────────────────────────────────────
  const handleSaveContent = async (newItem) => {
    if (!isMainAdmin) return;
    setIsSaving(true);
    try {
      let imageUrl = newItem.imageUrl;
      if (newItem.imageFile) imageUrl = await uploadImage(newItem.imageFile, 'content');

      const payload = {
        title:        newItem.title,
        description:  newItem.description,
        main_content: newItem.mainContent,
        image_url:    imageUrl || null,
        video_url:    newItem.videoUrl   || null,
        download_url: newItem.downloadUrl || null,
        section_id:   activeSectionId,
        views:        newItem.views  || 0,
        likes:        newItem.likes  || 0,
        hearts:       newItem.hearts || 0,
      };

      if (newItem.id) {
        const { error } = await supabase.from('content_items').update(payload).eq('id', newItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('content_items').insert({
          ...payload,
          sort_order: Date.now(),
        });
        if (error) throw error;
      }

      await Promise.all([fetchContent(activeSectionId), fetchCounts()]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
      setEditingContent(null);
    }
  };

  const handleOpenArticle = async (item) => {
    setSelectedArticle(item);

    // Navigate to the correct page
    const idx = filteredItems.findIndex(a => a.id === item.id);
    if (idx !== -1) setCurrentPage(Math.floor(idx / ITEMS_PER_PAGE) + 1);

    if (item.id) {
      const newViews = (item.views || 0) + 1;
      await supabase.rpc('increment_views', { item_id: item.id });
      const updated = { ...item, views: newViews };
      setCurrentItems(prev => prev.map(i => i.id === item.id ? updated : i));
      setSelectedArticle(updated);
    }
  };

  const handleReaction = async (item, type) => {
    if (!item.id) return;
    const { error } = await supabase.rpc('increment_reaction', { item_id: item.id, reaction_type: type });
    if (error) { console.error('Reaction error:', error); return; }
    const updated = {
      ...item,
      likes:  type === 'like'  ? (item.likes  || 0) + 1 : (item.likes  || 0),
      hearts: type === 'heart' ? (item.hearts || 0) + 1 : (item.hearts || 0),
    };
    setCurrentItems(prev => prev.map(i => i.id === item.id ? updated : i));
    setSelectedArticle(updated);
  };

  const handleDeleteClick = (contentId) => {
    if (!isMainAdmin) return;
    setDeletingContentId(contentId);
    setShowConfirmDelete(true);
  };

  const confirmDelete = async () => {
    if (!isMainAdmin || !deletingContentId) return;
    const { error } = await supabase.from('content_items').delete().eq('id', deletingContentId);
    if (!error) {
      await Promise.all([fetchContent(activeSectionId), fetchCounts()]);
      setSelectedArticle(null);
    }
    setShowConfirmDelete(false);
    setDeletingContentId(null);
  };

  // ── Admin auth ────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email: adminEmail, password: adminPass });
    if (error) setAuthError(error.message);
  };

  const handleLogout = () => supabase.auth.signOut();

  // ── Loading screen ────────────────────────────────────────
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center" dir="rtl">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-300 font-semibold tracking-wider">جاري تحميل المنصة الاحترافية...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3 sm:p-6" dir="rtl">
      <div className="flex flex-col lg:flex-row w-full max-w-7xl bg-white shadow-2xl rounded-3xl overflow-hidden border border-slate-200/80">

        {/* ── Sidebar ─────────────────────────────────────── */}
        <div className="w-full lg:w-80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 p-6 flex flex-col justify-between">
          <div>
            <div className="mb-8 text-center pt-4">
              <div className="inline-block p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-3 border border-indigo-500/30 shadow-inner">
                <Bookmark size={30} className="animate-pulse" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">مدونة الاقتصاد السلوكي</h1>
              <p className="text-xs text-indigo-300 mt-1 font-semibold uppercase tracking-widest">الأرشيف العلمي والمقالات</p>
            </div>

            <ul className="w-full space-y-2">
              {SECTIONS.map(({ id, name, icon: Icon }) => {
                const isActive = activeSectionId === id;
                const count    = sectionCounts[id] || 0;
                return (
                  <li key={id}>
                    <button onClick={() => handleSectionClick(id)}
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 translate-x-1'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      }`}>
                      <div className="flex items-center space-x-3 space-x-reverse">
                        <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'}`}>
                          <Icon size={18} />
                        </div>
                        <span>{name}</span>
                      </div>
                      {count > 0 && !NO_COUNT_SECTIONS.has(id) && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-black ${isActive ? 'bg-white text-indigo-900' : 'bg-slate-800 text-indigo-300'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pt-6 border-t border-slate-800 text-center">
            {isMainAdmin ? (
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-emerald-400 font-bold">● مدير النظام</span>
                <button onClick={handleLogout}
                  className="text-xs text-slate-400 hover:text-slate-200 underline transition">تسجيل الخروج</button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-medium">نظام التصفح الذكي 2026</p>
            )}
          </div>
        </div>

        {/* ── Main content ─────────────────────────────────── */}
        <div className="flex-1 bg-slate-50/50 p-6 md:p-10 flex flex-col items-start text-right overflow-y-auto max-h-screen">

          {/* Cover banner */}
          <div className="w-full mb-8">
            <div
              className="w-full h-64 md:h-72 overflow-hidden rounded-3xl shadow-xl relative group border border-slate-200 bg-slate-950 flex items-center justify-center"
              style={{ cursor: isMainAdmin ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
              onMouseDown={handleCoverMouseDown}
              onMouseMove={handleCoverMouseMove}
              onMouseUp={handleCoverMouseUp}
              onMouseLeave={handleCoverMouseUp}
              onWheel={handleCoverWheel}
            >
              <img src={coverImageUrl} alt="Dr. Alaa Bataineh"
                className="max-w-full max-h-full object-contain transition-transform duration-75 ease-out select-none"
                style={{ transform: `translate(${coverPos.x}px, ${coverPos.y}px) scale(${coverScale})` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-6 md:p-8 pointer-events-none">
                <div className="text-white">
                  <h2 className="text-3xl md:text-4xl font-black mb-1 drop-shadow-md">Dr. Alaa Bataineh</h2>
                  <span className="inline-block bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider px-3.5 py-1 rounded-full shadow">
                    Behavioural Economics Expert
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Settings panel */}
          {activeSectionId === 'settings' ? (
            <div className="w-full max-w-4xl bg-white p-8 rounded-3xl shadow-xl border border-slate-100 text-right">
              <h3 className="text-2xl font-black text-slate-900 mb-6 border-b pb-4 border-slate-100 flex items-center space-x-2 space-x-reverse">
                <Settings className="text-indigo-600 ml-2" size={24} />
                <span>إعدادات وتخصيص الموقع</span>
              </h3>

              {/* Admin login / logout */}
              {isMainAdmin ? (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">مسجّل الدخول كمدير: {session.user.email}</p>
                    <p className="text-xs text-emerald-600 mt-0.5">لديك صلاحيات كاملة لإدارة المحتوى</p>
                  </div>
                  <button onClick={handleLogout}
                    className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition">
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-slate-800 mb-4">تسجيل دخول المدير</h4>
                  <form onSubmit={handleLogin} className="space-y-3 max-w-sm">
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                      placeholder="البريد الإلكتروني"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
                    <input type="password" value={adminPass} onChange={e => setAdminPass(e.target.value)}
                      placeholder="كلمة المرور"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" required />
                    {authError && <p className="text-xs text-red-600 font-bold">{authError}</p>}
                    <button type="submit"
                      className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition text-sm">
                      دخول
                    </button>
                  </form>
                </div>
              )}

              {/* Cover image upload (admin only) */}
              {isMainAdmin && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-slate-700 text-sm font-bold mb-2">تحديث صورة الغلاف الرئيسية:</label>
                    <input type="file" accept="image/*" onChange={handleCoverImageChange}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm" />
                    <p className="text-xs text-slate-400 mt-1">الصورة تُرفع إلى التخزين السحابي وتظهر لجميع الزوار.</p>
                  </div>

                  <div className="border-t pt-6 border-slate-100">
                    <h4 className="text-lg font-bold text-slate-800 mb-4">ضبط مقاسات الغلاف</h4>
                    <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">التقريب: {coverScale.toFixed(1)}x</label>
                        <input type="range" min="0.3" max="3" step="0.1" value={coverScale}
                          onChange={(e) => { const v = parseFloat(e.target.value); setCoverScale(v); scheduleCoverSave(coverImageUrl, coverPos, v); }}
                          className="w-full accent-indigo-600" />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">الإزاحة الأفقية: {coverPos.x}px</label>
                        <input type="range" min="-300" max="300" step="1" value={coverPos.x}
                          onChange={(e) => { const p = { ...coverPos, x: parseInt(e.target.value) }; setCoverPos(p); scheduleCoverSave(coverImageUrl, p, coverScale); }}
                          className="w-full accent-indigo-600" />
                      </div>
                      <div>
                        <label className="block text-slate-700 text-xs font-bold mb-1">الإزاحة الرأسية: {coverPos.y}px</label>
                        <input type="range" min="-300" max="300" step="1" value={coverPos.y}
                          onChange={(e) => { const p = { ...coverPos, y: parseInt(e.target.value) }; setCoverPos(p); scheduleCoverSave(coverImageUrl, p, coverScale); }}
                          className="w-full accent-indigo-600" />
                      </div>
                      <button onClick={resetCoverTransform}
                        className="px-5 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-300 transition">
                        إعادة تعيين افتراضي
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          ) : (
            /* ── Section content ─────────────────────────── */
            <div className="w-full max-w-4xl flex flex-col min-h-[500px]" key={activeSectionId}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-slate-200 gap-4">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
                    {activeSectionObj.icon && <activeSectionObj.icon size={26} />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">قسم المنشورات</span>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{activeSectionName}</h3>
                  </div>
                </div>
                {isMainAdmin && (
                  <button onClick={() => { setEditingContent(null); setIsModalOpen(true); }}
                    className="flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 hover:scale-105 transition text-sm whitespace-nowrap">
                    <Plus size={18} className="ml-2" />
                    {activeSectionId === 'contact' ? 'إضافة وسيلة اتصال' : 'نشر محتوى جديد'}
                  </button>
                )}
              </div>

              {currentItems.length > 0 && (
                <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center space-x-3 space-x-reverse">
                  <Search size={20} className="text-slate-400 mr-1" />
                  <input type="text"
                    placeholder={`ابحث في ${activeSectionName} (${currentItems.length} عنصر)...`}
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-transparent outline-none text-slate-800 font-semibold text-sm" />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-lg">إلغاء</button>
                  )}
                </div>
              )}

              <div className="flex-grow">
                {paginatedItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedItems.map((item, index) => {
                      const globalIndex   = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                      const displayViews  = getSimulatedStat(item, 'views',  1240, 3500);
                      const displayLikes  = getSimulatedStat(item, 'likes',   180,  450);
                      const displayHearts = getSimulatedStat(item, 'hearts',   90,  280);
                      return (
                        <div key={item.id}
                          onClick={() => handleOpenArticle(item)}
                          className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:shadow-2xl hover:-translate-y-1 cursor-pointer flex flex-col justify-between group">
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center space-x-2 space-x-reverse">
                                <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">#{globalIndex}</span>
                                <span className="text-xs font-bold text-slate-500 flex items-center bg-slate-100 px-2.5 py-0.5 rounded-full">
                                  <Eye size={13} className="ml-1 text-indigo-600" /> {displayViews} مشاهدة
                                </span>
                              </div>
                              {isMainAdmin && (
                                <div className="flex space-x-1 space-x-reverse opacity-0 group-hover:opacity-100 transition">
                                  <button onClick={(e) => { e.stopPropagation(); setEditingContent(item); setIsModalOpen(true); }}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                              )}
                            </div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight mb-2 group-hover:text-indigo-600 transition">{stripHtml(item.title)}</h4>
                            <p className="text-slate-600 text-sm font-medium mb-4 leading-relaxed line-clamp-3">{stripHtml(item.description)}</p>
                          </div>
                          {item.imageUrl && (
                            <div className="mb-4 h-40 overflow-hidden rounded-2xl bg-slate-100 border border-slate-100">
                              <img src={item.imageUrl} alt={stripHtml(item.title)} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                            </div>
                          )}
                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-sm">
                            <div className="flex items-center space-x-3 space-x-reverse text-xs text-slate-500 font-bold">
                              <span className="flex items-center"><ThumbsUp size={13} className="ml-1 text-indigo-600" /> {displayLikes}</span>
                              <span className="flex items-center"><Heart size={13} className="ml-1 text-rose-500" /> {displayHearts}</span>
                            </div>
                            <div className="flex items-center space-x-1 space-x-reverse">
                              <span>عرض التفاصيل</span>
                              <ArrowRight size={16} className="transform group-hover:-translate-x-1 transition" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <Layers size={28} />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 mb-2">
                      {searchQuery ? 'لا توجد نتائج مطابقة' : `لا يوجد محتوى في ${activeSectionName} حالياً`}
                    </h4>
                    <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">
                      {searchQuery ? 'جرب البحث بكلمات مفتاحية أخرى.' : 'ابدأ بإضافة منشورات لهذا القسم.'}
                    </p>
                    {isMainAdmin && !searchQuery && (
                      <button onClick={() => { setEditingContent(null); setIsModalOpen(true); }}
                        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow hover:bg-indigo-700 transition">
                        <Plus size={18} className="ml-2" /> إضافة محتوى جديد
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              {filteredItems.length > ITEMS_PER_PAGE && (
                <div className="w-full mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-5 rounded-3xl shadow-md border border-slate-200/80">
                  <div className="text-xs font-extrabold text-slate-600">
                    صفحة <span className="text-indigo-600">{currentPage}</span> من <span className="text-slate-800">{totalPages}</span> (الإجمالي: {filteredItems.length})
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse flex-wrap justify-center">
                    <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                      className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 hover:text-white transition flex items-center space-x-1 space-x-reverse shadow-sm">
                      <ChevronRight size={16} className="ml-1" /><span>السابق</span>
                    </button>
                    <div className="flex space-x-1.5 space-x-reverse">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                        <button key={num} onClick={() => setCurrentPage(num)}
                          className={`w-10 h-10 rounded-2xl font-black text-sm transition shadow-sm ${
                            currentPage === num
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-500/30 scale-105'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}>{num}</button>
                      ))}
                    </div>
                    <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                      className="px-5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-black text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-600 hover:text-white transition flex items-center space-x-1 space-x-reverse shadow-sm">
                      <span>اللاحق</span><ChevronLeft size={16} className="mr-1" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────── */}
      <ContentModal
        key={isModalOpen ? (editingContent?.id || 'new') : 'closed'}
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingContent(null); }}
        onSave={handleSaveContent}
        initialContent={editingContent}
        sectionName={activeSectionName}
        isSaving={isSaving}
      />

      <ArticleReaderModal
        isOpen={Boolean(selectedArticle)}
        onClose={() => setSelectedArticle(null)}
        article={selectedArticle}
        allArticles={filteredItems}
        onSelectArticle={handleOpenArticle}
        onEdit={(art) => { setEditingContent(art); setIsModalOpen(true); }}
        onDelete={handleDeleteClick}
        isMainAdmin={isMainAdmin}
        onReact={handleReaction}
      />

      <ConfirmDeleteModal
        isOpen={showConfirmDelete}
        onClose={() => { setShowConfirmDelete(false); setDeletingContentId(null); }}
        onConfirm={confirmDelete}
        sectionName={activeSectionName}
      />
    </div>
  );
};

export default App;
