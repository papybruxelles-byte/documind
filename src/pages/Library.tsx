import { useState, useMemo, useEffect } from 'react';
import { useDocuments } from '@/hooks/useData';
import { PageHeader } from '@/components/AppShell';
import { getCategoryIcon, getCategoryColors } from '@/lib/category-utils';
import { Search, LayoutGrid, List, FileText, CheckCircle2, Loader2, Tag as TagIcon, Calendar, X } from 'lucide-react';
import { DOCUMENT_CATEGORIES, type DocumentCategory } from '@/types/database';

interface LibraryProps {
  onOpenDocument: (id: string) => void;
  initialCategory?: DocumentCategory | 'all';
}

export function Library({ onOpenDocument, initialCategory = 'all' }: LibraryProps) {
  const { documents, loading } = useDocuments();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DocumentCategory | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setCategoryFilter(initialCategory);
    if (initialCategory !== 'all') setShowFilters(true);
  }, [initialCategory]);

  const filtered = useMemo(() => {
    return documents.filter((doc) => {
      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(q);
        const matchesSummary = doc.summary?.toLowerCase().includes(q);
        const matchesKeywords = doc.keywords?.some((k) => k.toLowerCase().includes(q));
        const matchesTags = doc.document_tags?.some((dt) => dt.tags.name.toLowerCase().includes(q));
        const matchesCategory = doc.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSummary && !matchesKeywords && !matchesTags && !matchesCategory) return false;
      }

      return true;
    });
  }, [documents, search, categoryFilter]);

  const activeFilters = (categoryFilter !== 'all' ? 1 : 0) + (search ? 1 : 0);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Document Library"
        subtitle={`${documents.length} documents in your collection`}
      />

      {/* Search + filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, content, keywords, or tags..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all-smooth"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl border font-medium text-sm transition-all-smooth flex items-center gap-2 ${
              showFilters || activeFilters > 0
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Filters
            {activeFilters > 0 && (
              <span className="bg-blue-600 text-white text-xs px-1.5 rounded-full">{activeFilters}</span>
            )}
          </button>

          <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-3 transition-all-smooth ${view === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-3 transition-all-smooth ${view === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6 animate-fade-in-up">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all-smooth ${
                categoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories
            </button>
            {DOCUMENT_CATEGORIES.map((cat) => {
              const Icon = getCategoryIcon(cat);
              const colors = getCategoryColors(cat);
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all-smooth flex items-center gap-1.5 ${
                    categoryFilter === cat
                      ? `${colors.bg} ${colors.text} ${colors.border} border`
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300 mb-3" />
          <p className="text-slate-400">Loading your documents...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">
            {documents.length === 0 ? 'No documents yet' : 'No documents match your search'}
          </p>
          <p className="text-sm text-slate-400 mt-1">
            {documents.length === 0 ? 'Upload a document to get started' : 'Try adjusting your filters or search'}
          </p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc, i) => {
            const Icon = getCategoryIcon(doc.category);
            const colors = getCategoryColors(doc.category);
            const isProcessing = doc.ai_status === 'processing' || doc.ocr_status === 'processing';
            return (
              <button
                key={doc.id}
                onClick={() => onOpenDocument(doc.id)}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all-smooth overflow-hidden text-left animate-fade-in-up"
                style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
              >
                <div className={`h-28 bg-gradient-to-br ${colors.gradient} relative overflow-hidden flex items-center justify-center`}>
                  <Icon className="w-12 h-12 text-white/90" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all-smooth" />
                  <div className="absolute top-3 right-3">
                    {isProcessing ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-700 bg-white/90 px-2.5 py-1 rounded-full">
                        <Loader2 className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-white/90 px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className={`inline-flex items-center gap-1.5 text-xs font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full mb-2`}>
                    <Icon className="w-3 h-3" />
                    {doc.category}
                  </div>
                  <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{doc.title}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{doc.summary || 'No summary available'}</p>

                  {doc.document_tags && doc.document_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {doc.document_tags.slice(0, 3).map((dt) => (
                        <span key={dt.tag_id} className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {dt.tags.name}
                        </span>
                      ))}
                      {doc.document_tags.length > 3 && (
                        <span className="text-xs text-slate-400">+{doc.document_tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-xs text-slate-400 mt-3">
                    <Calendar className="w-3 h-3" />
                    {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-50">
            {filtered.map((doc) => {
              const Icon = getCategoryIcon(doc.category);
              const colors = getCategoryColors(doc.category);
              const isProcessing = doc.ai_status === 'processing' || doc.ocr_status === 'processing';
              return (
                <button
                  key={doc.id}
                  onClick={() => onOpenDocument(doc.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-all-smooth text-left group"
                >
                  <div className={`w-11 h-11 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${colors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900 truncate group-hover:text-blue-600 transition-colors">{doc.title}</p>
                      <span className={`text-xs font-medium ${colors.text} ${colors.bg} px-2 py-0.5 rounded-full flex-shrink-0`}>
                        {doc.category}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 truncate mt-0.5">{doc.summary || 'No summary available'}</p>
                  </div>
                  {doc.document_tags && doc.document_tags.length > 0 && (
                    <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                      <TagIcon className="w-4 h-4 text-slate-300" />
                      <span className="text-xs text-slate-400">{doc.document_tags.length} tags</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
