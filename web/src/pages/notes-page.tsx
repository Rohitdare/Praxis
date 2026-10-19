import * as React from "react"
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Save,
  CheckCircle2,
  Loader2,
  WifiOff,
  ArrowLeft,
  Clock,
  ExternalLink,
} from "lucide-react"
import { Link } from "react-router-dom"
import { useAuth } from "@/lib/auth/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  fetchNotes,
  createNote,
  saveNote,
  deleteNote,
  type NoteItem,
} from "@/lib/notes/service"

export function NotesPage() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const userId = isAuthLoading ? undefined : (user?.id || undefined)

  const [notes, setNotes] = React.useState<NoteItem[]>([])
  const [selectedNoteId, setSelectedNoteId] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Editor state
  const [title, setTitle] = React.useState("")
  const [content, setContent] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveSuccess, setSaveSuccess] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Mobile view toggle (show editor or show list)
  const [showMobileEditor, setShowMobileEditor] = React.useState(false)

  const isOnline = typeof navigator === "undefined" || navigator.onLine

  // Find currently selected note
  const activeNote = React.useMemo(
    () => notes.find((n) => n.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  )

  // Track if active note has unsaved edits
  const hasUnsavedChanges = React.useMemo(() => {
    if (!activeNote) return false
    return (
      title !== (activeNote.title || "") ||
      content !== (activeNote.content || "")
    )
  }, [activeNote, title, content])

  // Warn on page unload when there are unsaved changes
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Load notes on mount
  const loadNotesList = React.useCallback(async () => {
    if (!userId) {
      setNotes([])
      setSelectedNoteId(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setLoadError(null)
    try {
      const data = await fetchNotes(userId)
      setNotes(data)
      // Auto-select first note if none selected
      setSelectedNoteId((prev) => prev ?? (data.length > 0 ? data[0].id : null))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load notes")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  const prevUserIdRef = React.useRef<string | undefined>(userId)
  React.useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      setNotes([])
      setSelectedNoteId(null)
      setTitle("")
      setContent("")
      setIsLoading(true)
    }
    prevUserIdRef.current = userId
    void loadNotesList()
  }, [loadNotesList, userId])

  // Ref to hold latest values for auto-save, onBlur, and unmount flush
  const latestValuesRef = React.useRef({
    title,
    content,
    selectedNoteId,
    userId,
    isOnline,
    activeNote,
    isSaving,
    hasUnsavedChanges,
  })
  latestValuesRef.current = {
    title,
    content,
    selectedNoteId,
    userId,
    isOnline,
    activeNote,
    isSaving,
    hasUnsavedChanges,
  }

  // Synchronize editor inputs ONLY when selected note ID changes
  const prevSelectedIdRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (prevSelectedIdRef.current !== selectedNoteId) {
      prevSelectedIdRef.current = selectedNoteId
      if (activeNote) {
        setTitle(activeNote.title || "")
        setContent(activeNote.content || "")
        setSaveError(null)
        setSaveSuccess(false)
      } else {
        setTitle("")
        setContent("")
      }
    }
  }, [selectedNoteId, activeNote])

  // Save current note
  const handleSave = React.useCallback(async () => {
    const {
      title: curTitle,
      content: curContent,
      selectedNoteId: curId,
      userId: curUserId,
      isOnline: curOnline,
      isSaving: currentlySaving,
    } = latestValuesRef.current

    if (!curId || !curUserId || !curOnline || currentlySaving) return

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const trimmedTitle = curTitle.trim()
      const effectiveTitle =
        trimmedTitle ||
        (curContent.trim() ? curContent.trim().split("\n")[0].slice(0, 60) : "Untitled Note")

      const updated = await saveNote(
        curId,
        curUserId,
        effectiveTitle,
        curContent
      )

      setNotes((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n))
      )
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }, [])

  // Debounced auto-save (calm computing)
  React.useEffect(() => {
    if (!hasUnsavedChanges || !selectedNoteId || !userId || !isOnline) return

    const timer = setTimeout(() => {
      void handleSave()
    }, 600)

    return () => clearTimeout(timer)
  }, [title, content, hasUnsavedChanges, selectedNoteId, userId, isOnline, handleSave])

  // Flush pending changes on unmount or page navigation
  React.useEffect(() => {
    return () => {
      const current = latestValuesRef.current
      if (current.hasUnsavedChanges && current.selectedNoteId && current.userId && current.isOnline) {
        void handleSave()
      }
    }
  }, [handleSave])

  // Create new note action
  const handleCreateNote = async () => {
    if (!userId || !isOnline || isSaving) return

    if (hasUnsavedChanges) {
      await handleSave()
    }

    setIsSaving(true)
    setSaveError(null)
    try {
      const newNote = await createNote(userId, "Untitled Note", "")
      setNotes((prev) => [newNote, ...prev])
      setSelectedNoteId(newNote.id)
      setShowMobileEditor(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to create note")
    } finally {
      setIsSaving(false)
    }
  }

  // Delete current note
  const handleDelete = async (noteIdToDelete: string) => {
    if (!userId || isDeleting) return
    if (!window.confirm("Are you sure you want to delete this note?")) return

    setIsDeleting(true)
    try {
      await deleteNote(noteIdToDelete, userId)
      const remaining = notes.filter((n) => n.id !== noteIdToDelete)
      setNotes(remaining)
      if (selectedNoteId === noteIdToDelete) {
        setSelectedNoteId(remaining.length > 0 ? remaining[0].id : null)
        setShowMobileEditor(false)
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to delete note")
    } finally {
      setIsDeleting(false)
    }
  }

  // Keyboard shortcut: Cmd/Ctrl+Enter to save
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleSave])

  // Filter notes by query
  const filteredNotes = React.useMemo(() => {
    if (!searchQuery.trim()) return notes
    const q = searchQuery.toLowerCase().trim()
    return notes.filter(
      (n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        n.raw_input.toLowerCase().includes(q)
    )
  }, [notes, searchQuery])

  // Handle selecting a note with auto-save of current note
  const handleSelectNote = (noteId: string) => {
    if (noteId === selectedNoteId) {
      setShowMobileEditor(true)
      return
    }
    if (hasUnsavedChanges) {
      void handleSave()
    }
    setSelectedNoteId(noteId)
    setShowMobileEditor(true)
  }

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl mx-auto py-2 md:py-4 space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <FileText className="size-5 text-muted-foreground" />
          <h1 className="font-heading font-extrabold text-2xl md:text-3xl tracking-tight text-foreground">
            Notes
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-mono border border-border/60 tabular-nums">
            {notes.length}
          </span>
        </div>

        <Button
          size="sm"
          onClick={handleCreateNote}
          disabled={!isOnline || isSaving}
          className="text-xs inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs rounded-lg font-medium"
          aria-label="New Note"
        >
          <Plus className="size-3.5" />
          New Note
        </Button>
      </div>

      {/* Offline Mode Banner (ADR-02) */}
      {!isOnline && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5"
        >
          <WifiOff className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Offline: Read-only mode</p>
            <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90">
              In accordance with ADR-02, creating and editing notes requires an active internet connection. You can view cached notes while offline.
            </p>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[560px]">
        {/* Left Column: Notes List */}
        <div
          className={`md:col-span-4 space-y-3 ${
            showMobileEditor ? "hidden md:block" : "block"
          }`}
        >
          {/* In-Memory Search Input */}
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8 bg-card"
              aria-label="Search notes"
            />
          </div>

          {/* List Content */}
          {isLoading ? (
            <div className="space-y-2 py-4 animate-pulse">
              <div className="h-16 bg-muted/50 rounded-lg" />
              <div className="h-16 bg-muted/40 rounded-lg" />
              <div className="h-16 bg-muted/30 rounded-lg" />
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive text-center space-y-2">
              <p>{loadError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadNotesList()}
                className="text-xs h-7"
              >
                Retry
              </Button>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="p-8 text-center rounded-lg border border-dashed border-border bg-card/40 space-y-2">
              <FileText className="size-6 text-muted-foreground mx-auto" />
              <p className="text-xs font-medium text-foreground">
                {searchQuery ? "No matching notes found" : "No notes yet"}
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                {searchQuery
                  ? "Try searching for a different title or keyword."
                  : "Click 'New Note' above to create your first organized thought."}
              </p>
            </div>
          ) : (
            <div
              className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1"
              role="list"
              aria-label="Notes list"
            >
              {filteredNotes.map((note) => {
                const isSelected = note.id === selectedNoteId
                const preview =
                  note.content?.slice(0, 80) || note.raw_input.slice(0, 80)

                return (
                  <div
                    key={note.id}
                    role="listitem"
                    onClick={() => handleSelectNote(note.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all text-left space-y-1.5 ${
                      isSelected
                        ? "border-foreground/30 bg-secondary/80 shadow-2xs"
                        : "border-border/70 bg-card/60 hover:bg-muted/40 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading font-bold text-xs tracking-tight text-foreground truncate">
                        {note.title || "Untitled Note"}
                      </h3>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1 font-mono">
                        <Clock className="size-2.5" />
                        {new Date(note.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {preview}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Note Editor */}
        <div
          className={`md:col-span-8 ${
            showMobileEditor ? "block" : "hidden md:block"
          }`}
        >
          {activeNote ? (
            <div className="p-4 md:p-6 rounded-xl border border-border/80 bg-card/60 space-y-4 shadow-2xs">
              {/* Mobile Back to List Bar */}
              <div className="flex items-center justify-between md:hidden pb-2.5 border-b border-border/60">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowMobileEditor(false)}
                  className="text-xs h-8 px-2.5 min-h-[36px] flex items-center"
                >
                  <ArrowLeft className="size-3.5 mr-1" />
                  Back to List
                </Button>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {hasUnsavedChanges ? "Unsaved edits" : "Saved"}
                </span>
              </div>

              {/* Top Editor Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Note Editor
                  </span>
                  {hasUnsavedChanges && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/20">
                      Unsaved
                    </span>
                  )}
                  {saveSuccess && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 border border-emerald-500/20">
                      <CheckCircle2 className="size-3" />
                      Saved
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-xs h-8 px-2.5 min-h-[36px] sm:h-7 text-muted-foreground hover:text-foreground rounded-md"
                    title="Open full item detail"
                  >
                    <Link to={`/items/${activeNote.id}`}>
                      <ExternalLink className="size-3.5 mr-1" />
                      Detail
                    </Link>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(activeNote.id)}
                    disabled={isDeleting}
                    className="text-xs h-8 px-2 min-h-[36px] sm:h-7 text-destructive hover:bg-destructive/10 rounded-md"
                    title="Delete Note"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => void handleSave()}
                    disabled={!isOnline || isSaving}
                    className="text-xs h-8 px-3 min-h-[36px] sm:h-7 inline-flex items-center gap-1 shadow-2xs rounded-lg font-medium"
                    aria-label="Save note"
                  >
                    {isSaving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>

              {/* Error Alert */}
              {saveError && (
                <div
                  role="alert"
                  className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive space-y-1"
                >
                  <p className="font-semibold">Unable to save note</p>
                  <p className="text-[11px]">{saveError}</p>
                </div>
              )}

              {/* Title Field */}
              <div className="space-y-1">
                <Input
                  type="text"
                  placeholder="Note Title..."
                  value={title}
                  onFocus={(e) => {
                    if (title === "Untitled Note") {
                      e.target.select()
                    }
                  }}
                  onBlur={() => {
                    if (hasUnsavedChanges) {
                      void handleSave()
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (hasUnsavedChanges) {
                        void handleSave()
                      }
                    }
                  }}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!isOnline || isSaving}
                  className="font-heading text-lg md:text-xl font-bold tracking-tight border-none px-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:text-muted-foreground/40 text-foreground"
                  aria-label="Note title"
                />
              </div>

              {/* Content Textarea */}
              <div className="space-y-1">
                <textarea
                  placeholder="Write your note or thoughts here (supports plain text and Markdown)..."
                  value={content}
                  onBlur={() => {
                    if (hasUnsavedChanges) {
                      void handleSave()
                    }
                  }}
                  onChange={(e) => setContent(e.target.value)}
                  disabled={!isOnline || isSaving}
                  rows={14}
                  className="w-full resize-y bg-background/50 text-xs md:text-sm text-foreground/90 placeholder:text-muted-foreground/40 border border-border/70 rounded-xl p-3.5 outline-none focus:border-ring focus:ring-1 focus:ring-ring font-sans leading-relaxed transition-all"
                  aria-label="Note content"
                />
              </div>

              {/* Immutable Raw Input Provenance Badge (ADR-06) */}
              <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  Raw capture: &quot;{activeNote.raw_input.slice(0, 50)}
                  {activeNote.raw_input.length > 50 ? "..." : ""}&quot;
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {activeNote.id.slice(0, 8)}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed border-border bg-card/20 space-y-3">
              <FileText className="size-8 text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Select a note to read or edit
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Choose an existing note from the list on the left, or create a new one.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleCreateNote}
                disabled={!isOnline || isSaving}
                className="text-xs"
              >
                <Plus className="size-3.5 mr-1" />
                New Note
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
