import { FormEvent, useMemo, useState, useEffect, useRef } from "react";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { parseCookies, getSession, readUsers } from "@/lib/auth";
import { readJson } from "@/lib/db";
import { initTheme, applyTheme, getStoredTheme, setStoredTheme } from "@/lib/theme";

type NoteCategory = string;

type Note = {
  id: string;
  userId: string;
  title: string;
  text: string;
  category: NoteCategory;
  createdAt: number;
};

type DashboardProps = {
  user: { id: string; email: string };
  notes: Note[];
};

const COOKIE_NAME = "mindlyst_session";
const DEFAULT_CATEGORIES = ["business", "perso", "sport", "clients", "urgent", "autres"];

export default function DashboardPage({ user, notes: initialNotes }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState<NoteCategory>("business");
  const [filter, setFilter] = useState<NoteCategory | "toutes">("toutes");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editCategory, setEditCategory] = useState<NoteCategory>("business");
  const [editError, setEditError] = useState<string | null>(null);
  const [reminderNoteId, setReminderNoteId] = useState<string | null>(null);
  const [reminderDateTime, setReminderDateTime] = useState("");
  const [reminders, setReminders] = useState<Record<string, { id: string; reminderDate: number }[]>>({});
  const [loadingReminder, setLoadingReminder] = useState(false);
  const [notesRemainingToday, setNotesRemainingToday] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [sharingNoteId, setSharingNoteId] = useState<string | null>(null);
  const [sharingReminderId, setSharingReminderId] = useState<string | null>(null);
  const [shareUsername, setShareUsername] = useState("");
  const [sharePermission, setSharePermission] = useState<"read" | "write">("read");
  const [sharedNotes, setSharedNotes] = useState<Note[]>([]);
  const [sharedNotesWithShareId, setSharedNotesWithShareId] = useState<Array<{ note: Note; shareId: string }>>([]);
  const [ownedShares, setOwnedShares] = useState<Array<{ shareId: string; noteId: string; noteTitle: string; sharedWithUsername: string; sharedWithEmail: string; permission: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [publicShareLinks, setPublicShareLinks] = useState<Record<string, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const isRecordingRef = useRef(false);
  const [integrations, setIntegrations] = useState<Array<{ type: string; enabled: boolean }>>([]);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [adminUsers, setAdminUsers] = useState<
    Array<{ id: string; username: string; email: string; createdAt: number; isAdmin: boolean }>
  >([]);
  const [adminTotalUsers, setAdminTotalUsers] = useState<number | null>(null);
  const [adminUserCount, setAdminUserCount] = useState<number | null>(null);
  const [adminSearch, setAdminSearch] = useState("");
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState<string | null>(null);

  const filteredNotes = useMemo(() => {
    let filtered: Note[];
    if (filter === "toutes") {
      filtered = notes;
    } else {
      filtered = notes.filter(note => note.category === filter);
    }
    
    // Trier pour mettre les notes avec rappels en priorité (en haut)
    return filtered.sort((a, b) => {
      const aHasReminders = reminders[a.id] && reminders[a.id].length > 0;
      const bHasReminders = reminders[b.id] && reminders[b.id].length > 0;
      
      // Si une note a des rappels et l'autre non, celle avec rappels vient en premier
      if (aHasReminders && !bHasReminders) return -1;
      if (!aHasReminders && bHasReminders) return 1;
      
      // Si les deux ont des rappels ou aucun, trier par date de création (plus récent en premier)
      return b.createdAt - a.createdAt;
    });
  }, [notes, filter, reminders]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Veuillez saisir un titre.");
      return;
    }
    if (!text.trim()) {
      setError("Veuillez saisir un texte.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, text, category })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string; limitReached?: boolean; remainingToday?: number };
        if (payload.limitReached) {
          setError(payload.error ?? "Limite atteinte");
          await loadNotesRemaining();
        } else {
          throw new Error(payload.error ?? "Erreur lors de l'ajout");
        }
        return;
      }
      const payload = (await response.json()) as { note: Note; remainingToday?: number };
      setNotes(prev => [payload.note, ...prev]);
      setTitle("");
      setText("");
      setCategory("business");
      if (payload.remainingToday !== undefined) {
        setNotesRemainingToday(payload.remainingToday);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function loadNotesRemaining() {
    try {
      const response = await fetch("/api/subscription/usage");
      if (response.ok) {
        const data = (await response.json()) as { notesRemainingToday: number; plan: "free" | "pro"; isAdmin?: boolean };
        setNotesRemainingToday(data.notesRemainingToday);
        setUserPlan(data.plan);
        setIsAdmin(data.isAdmin || false);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'utilisation:", err);
    }
  }

  async function handleActivateAdmin() {
    if (!adminCode.trim()) {
      setError("Veuillez entrer un code");
      return;
    }
    try {
      const response = await fetch("/api/admin/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: adminCode }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Code invalide");
      }
      setAdminCode("");
      setShowAdminForm(false);
      await loadNotesRemaining();
      alert("✅ Mode admin activé ! Vous pouvez maintenant créer un nombre illimité de notes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'activation");
    }
  }

  async function loadAdminUsers(searchTerm = "") {
    if (!isAdmin) return;

    setAdminUsersLoading(true);
    setAdminUsersError(null);
    try {
      const params = new URLSearchParams();
      const trimmed = searchTerm.trim();
      if (trimmed) {
        params.set("search", trimmed);
      }
      const query = params.toString();
      const response = await fetch(`/api/admin/users${query ? `?${query}` : ""}`);
      if (!response.ok) {
        let message = "Erreur lors du chargement des utilisateurs.";
        if (response.status === 403) {
          message = "Accès refusé (réservé aux administrateurs).";
        } else {
          try {
            const payload = (await response.json()) as { error?: string };
            if (payload?.error) {
              message = payload.error;
            }
          } catch {
            // ignore parsing errors
          }
        }
        setAdminUsers([]);
        setAdminTotalUsers(null);
        setAdminUserCount(null);
        setAdminUsersError(message);
        return;
      }

      const data = (await response.json()) as {
        totalUsers: number;
        count: number;
        users: Array<{ id: string; username: string; email: string; createdAt: number; isAdmin: boolean }>;
      };
      setAdminTotalUsers(data.totalUsers);
      setAdminUserCount(data.count);
      setAdminUsers(data.users);
    } catch (err) {
      setAdminUsersError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setAdminUsersLoading(false);
    }
  }

  useEffect(() => {
    loadNotesRemaining();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setAdminUsers([]);
      setAdminTotalUsers(null);
      setAdminUserCount(null);
      setAdminUsersError(null);
      return;
    }

    const handle = setTimeout(() => {
      void loadAdminUsers(adminSearch);
    }, 350);

    return () => clearTimeout(handle);
  }, [adminSearch, isAdmin]);

  function toggleNote(noteId: string) {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      if (next.has(noteId)) {
        next.delete(noteId);
      } else {
        next.add(noteId);
      }
      return next;
    });
  }

  function startEdit(note: Note) {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditText(note.text);
    setEditCategory(note.category);
    setEditError(null);
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.add(note.id);
      return next;
    });
  }

  function cancelEdit() {
    setEditingNoteId(null);
    setEditTitle("");
    setEditText("");
    setEditCategory("business");
    setEditError(null);
  }

  async function handleUpdate(noteId: string) {
    setEditError(null);
    if (!editTitle.trim()) {
      setEditError("Veuillez saisir un titre.");
      return;
    }
    if (!editText.trim()) {
      setEditError("Veuillez saisir un texte.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, text: editText, category: editCategory })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la modification");
      }
      const payload = (await response.json()) as { note: Note };
      setNotes(prev => prev.map(note => (note.id === noteId ? payload.note : note)));
      cancelEdit();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Suppression impossible");
      }
      setNotes(prev => prev.filter(note => note.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    await router.push("/login");
  }

  async function loadReminders() {
    try {
      const response = await fetch("/api/reminders");
      if (response.ok) {
        const data = (await response.json()) as { reminders: Array<{ id: string; noteId: string; reminderDate: number }> };
        const grouped = data.reminders.reduce<Record<string, Array<{ id: string; reminderDate: number }>>>((acc, r) => {
          if (!acc[r.noteId]) acc[r.noteId] = [];
          acc[r.noteId].push({ id: r.id, reminderDate: r.reminderDate });
          return acc;
        }, {});
        setReminders(grouped);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des rappels:", err);
    }
  }

  useEffect(() => {
    loadReminders();
    loadCategories();
    loadSharedNotes();
    loadOwnedShares();
    loadIntegrations();
    loadContacts();
    const currentTheme = initTheme();
    setTheme(currentTheme);

    // Vérifier les messages de succès/erreur d'intégration
    if (router.query.integration_success) {
      const successMessage = router.query.integration_success === "google_calendar" 
        ? "✅ Google Calendar connecté ! Tes notes avec dates seront ajoutées automatiquement."
        : "✅ Intégration réussie !";
      setTimeout(() => {
        alert(successMessage);
        router.replace("/dashboard", undefined, { shallow: true });
        loadIntegrations();
      }, 100);
    }
    if (router.query.integration_error) {
      const error = router.query.integration_error as string;
      let message = "Erreur lors de la connexion";
      if (error === "not_configured") {
        message = "L'intégration n'est pas encore configurée. Contacte le support si le problème persiste.";
      } else if (error === "connection_failed") {
        message = "Échec de la connexion. Réessaie dans quelques instants.";
      }
      setTimeout(() => {
        alert(`❌ ${message}`);
        router.replace("/dashboard", undefined, { shallow: true });
      }, 100);
    }

    // Initialiser la reconnaissance vocale
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = "fr-FR"; // Français par défaut

        recognitionInstance.onresult = (event: SpeechRecognitionEvent) => {
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            }
          }

          if (finalTranscript) {
            setText((prev) => prev + finalTranscript);
          }
        };

        recognitionInstance.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Erreur de reconnaissance vocale:", event.error);
          
          // Ne pas arrêter pour certaines erreurs mineures
          if (event.error === "no-speech") {
            // L'API s'arrête automatiquement après un silence, on va la relancer
            if (isRecordingRef.current && !isManuallyStoppedRef.current) {
              setTimeout(() => {
                try {
                  recognitionInstance.start();
                } catch (err) {
                  // Ignorer les erreurs de démarrage si déjà en cours
                }
              }, 100);
            }
            return;
          }
          
          if (event.error === "not-allowed") {
            setError("Permission microphone refusée. Veuillez autoriser l'accès au microphone.");
            setIsRecording(false);
            isRecordingRef.current = false;
            isManuallyStoppedRef.current = true;
          } else if (event.error === "aborted") {
            // Arrêt manuel, ne rien faire
          } else {
            setError(`Erreur de reconnaissance: ${event.error}`);
            setIsRecording(false);
            isRecordingRef.current = false;
            isManuallyStoppedRef.current = true;
          }
        };

        recognitionInstance.onend = () => {
          // Relancer automatiquement si l'enregistrement est toujours actif et n'a pas été arrêté manuellement
          if (isRecordingRef.current && !isManuallyStoppedRef.current) {
            setTimeout(() => {
              try {
                recognitionInstance.start();
              } catch (err) {
                // Si l'API est déjà en cours, on ignore l'erreur
                console.log("Reconnaissance déjà en cours");
              }
            }, 100);
          } else {
            setIsRecording(false);
            isRecordingRef.current = false;
          }
        };

        setRecognition(recognitionInstance);
      }
    }

    return () => {
      // Le nettoyage sera géré par la variable recognition dans le state
    };
  }, []);

  // Nettoyage lors du démontage
  useEffect(() => {
    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [recognition]);

  async function loadSharedNotes() {
    try {
      const response = await fetch("/api/shares");
      if (response.ok) {
        const data = (await response.json()) as { shares: Array<{ id: string; noteId: string; permission: string }> };
        if (data.shares.length > 0) {
          // Charger les notes partagées
          const notesResponse = await fetch("/api/notes");
          if (notesResponse.ok) {
            const notesData = (await notesResponse.json()) as { notes: Note[] };
            const allNotes = notesData.notes;
            const sharedNoteIds = new Set(data.shares.map((s) => s.noteId));
            const shared = allNotes.filter((n) => sharedNoteIds.has(n.id));
            setSharedNotes(shared);
            
            // Stocker les notes avec leur shareId pour pouvoir les supprimer
            const notesWithShareId = data.shares.map(share => {
              const note = shared.find(n => n.id === share.noteId);
              return note ? { note, shareId: share.id } : null;
            }).filter((item): item is { note: Note; shareId: string } => item !== null);
            setSharedNotesWithShareId(notesWithShareId);
          }
        } else {
          setSharedNotes([]);
          setSharedNotesWithShareId([]);
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement des notes partagées:", err);
    }
  }

  async function loadOwnedShares() {
    try {
      const response = await fetch("/api/shares?type=owned");
      if (response.ok) {
        const data = (await response.json()) as { shares: Array<{ id: string; noteId: string; sharedWithId: string; permission: string }> };
        
        if (data.shares.length > 0) {
          // Récupérer les emails des utilisateurs et les titres des notes via l'API
          const detailsResponse = await fetch("/api/shares/owned-details");
          let sharesWithDetails: Array<{ shareId: string; noteId: string; noteTitle: string; sharedWithUsername: string; sharedWithEmail: string; permission: string }> = [];
          
          if (detailsResponse.ok) {
            const detailsData = (await detailsResponse.json()) as { 
              shares: Array<{ shareId: string; noteId: string; noteTitle: string; sharedWithUsername: string; sharedWithEmail: string; permission: string }> 
            };
            sharesWithDetails = detailsData.shares;
          } else {
            // Fallback : utiliser les données de base sans pseudos
            const notesResponse = await fetch("/api/notes");
            let allNotes: Note[] = [];
            if (notesResponse.ok) {
              const notesData = (await notesResponse.json()) as { notes: Note[] };
              allNotes = notesData.notes;
            }
            
            sharesWithDetails = data.shares.map((share) => {
              const note = allNotes.find(n => n.id === share.noteId);
              return {
                shareId: share.id,
                noteId: share.noteId,
                noteTitle: note?.title || "Note",
                sharedWithUsername: "Utilisateur",
                sharedWithEmail: "Utilisateur",
                permission: share.permission,
              };
            });
          }
          
          setOwnedShares(sharesWithDetails);
        } else {
          setOwnedShares([]);
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement des partages créés:", err);
    }
  }

  async function handleDeleteSharedNote(shareId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette note partagée de votre liste ?")) {
      return;
    }
    try {
      const response = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la suppression");
      }
      // Recharger les notes partagées
      await loadSharedNotes();
      await loadOwnedShares();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression de la note partagée");
    }
  }

  async function handleDeleteOwnedShare(shareId: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce partage ? La personne ne pourra plus accéder à cette note.")) {
      return;
    }
    try {
      const response = await fetch("/api/shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareId }),
      });
      
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const errorMsg = (payload as { error?: string }).error ?? "Erreur lors de la suppression";
        alert("❌ Erreur: " + errorMsg);
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      
      // Recharger les partages
      await loadOwnedShares();
      setError(null);
      alert("✅ Partage supprimé avec succès !");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erreur lors de la suppression du partage";
      setError(errorMsg);
      alert("❌ Erreur: " + errorMsg);
    }
  }

  async function loadContacts() {
    try {
      const response = await fetch("/api/contacts");
      if (response.ok) {
        const data = (await response.json()) as { contacts: Array<{ contactUserId: string; contactUsername: string; contactEmail: string }> };
        setContacts(data.contacts.map(c => ({ id: c.contactUserId, username: c.contactUsername, email: c.contactEmail })));
      }
    } catch (err) {
      console.error("Erreur lors du chargement des contacts:", err);
    }
  }

  async function handleSearchUsers() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/contacts?search=${encodeURIComponent(searchQuery.trim())}`);
      if (response.ok) {
        const data = (await response.json()) as { users: Array<{ id: string; username: string; email: string }> };
        // Filtrer les utilisateurs déjà dans les contacts
        const contactUserIds = new Set(contacts.map((c) => c.id));
        setSearchResults(data.users.filter((u) => !contactUserIds.has(u.id) && u.id !== user.id));
      }
    } catch (err) {
      console.error("Erreur lors de la recherche:", err);
    }
  }

  async function handleShareReminder(reminderId: string | null) {
    if (!reminderId) {
      setError("Aucun rappel sélectionné.");
      return;
    }
    if (!shareUsername.trim()) {
      setError("Veuillez entrer un pseudo");
      return;
    }
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reminderId,
          shareType: "reminder",
          sharedWithUsername: shareUsername.replace("@", ""),
          permission: sharePermission,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors du partage");
      }
      setShareUsername("");
      setSharingReminderId(null);
      setSearchQuery("");
      setSearchResults([]);
      setError(null);
      alert("Rappel partagé avec succès !");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du partage du rappel");
    }
  }

  async function handleShareNote(noteId: string) {
    if (!shareUsername.trim()) {
      setError("Veuillez entrer un pseudo");
      return;
    }
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, sharedWithUsername: shareUsername.replace("@", ""), permission: sharePermission }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors du partage");
      }
      setShareUsername("");
      setSharingNoteId(null);
      setError(null);
      await loadOwnedShares();
      alert("Note partagée avec succès !");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du partage");
    }
  }

  async function handleCreatePublicLink(noteId: string) {
    try {
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, createPublicLink: true }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la création du lien");
      }
      const data = (await response.json()) as { publicLink: string; shareToken: string };
      setPublicShareLinks((prev) => ({ ...prev, [noteId]: data.publicLink }));
      setSharingNoteId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la création du lien");
    }
  }

  async function handleCopyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      alert("Lien copié dans le presse-papiers !");
    } catch (err) {
      console.error("Erreur lors de la copie:", err);
    }
  }


  function startVoiceRecording() {
    if (!recognition) {
      setError("La reconnaissance vocale n'est pas disponible dans votre navigateur. Veuillez utiliser Chrome, Edge ou Safari.");
      return;
    }

    if (isRecording) {
      // Arrêter manuellement
      isManuallyStoppedRef.current = true;
      isRecordingRef.current = false;
      recognition.stop();
      setIsRecording(false);
      setTranscription("");
    } else {
      try {
        // Réinitialiser le flag d'arrêt manuel
        isManuallyStoppedRef.current = false;
        isRecordingRef.current = true;
        
        setTranscription("");
        setError(null);
        recognition.start();
        setIsRecording(true);
      } catch (err: any) {
        // Si l'erreur est "already started", on continue quand même
        if (err?.message?.includes("already") || err?.name === "InvalidStateError") {
          setIsRecording(true);
          isRecordingRef.current = true;
        } else {
          console.error("Erreur lors du démarrage de l'enregistrement:", err);
          setError("Impossible de démarrer l'enregistrement vocal.");
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      }
    }
  }

  async function loadIntegrations() {
    try {
      const response = await fetch("/api/integrations");
      if (response.ok) {
        const data = (await response.json()) as { integrations: Array<{ type: string; enabled: boolean }> };
        setIntegrations(data.integrations);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des intégrations:", err);
    }
  }

  async function connectGoogleCalendar() {
    window.location.href = "/api/integrations/google-calendar/auth";
  }

  async function disconnectIntegration(type: string) {
    if (!confirm(`Êtes-vous sûr de vouloir déconnecter ${type} ?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/integrations?type=${type}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await loadIntegrations();
        alert("Intégration déconnectée avec succès");
      }
    } catch (err) {
      setError("Erreur lors de la déconnexion");
    }
  }

  async function loadCategories() {
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = (await response.json()) as { categories: string[] };
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des catégories:", err);
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) {
      setError("Veuillez entrer un nom de catégorie");
      return;
    }
    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de l'ajout");
      }
      const data = (await response.json()) as { categories: string[] };
      setCategories(data.categories);
      setNewCategoryName("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout de la catégorie");
    }
  }

  async function handleDeleteCategory(categoryName: string) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la catégorie "${categoryName}" ? Les notes utilisant cette catégorie ne seront pas supprimées, mais vous devrez leur attribuer une nouvelle catégorie.`)) {
      return;
    }
    try {
      const response = await fetch("/api/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la suppression");
      }
      const data = (await response.json()) as { categories: string[] };
      setCategories(data.categories);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression de la catégorie");
    }
  }

  async function handleUpdateCategory(oldName: string, newName: string) {
    if (!newName.trim()) {
      setError("Veuillez entrer un nom de catégorie");
      return;
    }
    try {
      const response = await fetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la modification");
      }
      const data = (await response.json()) as { categories: string[] };
      setCategories(data.categories);
      setEditingCategory(null);
      setEditCategoryName("");
      setError(null);
      // Recharger les notes pour mettre à jour les catégories
      const notesResponse = await fetch("/api/notes");
      if (notesResponse.ok) {
        const notesData = (await notesResponse.json()) as { notes: Note[] };
        setNotes(notesData.notes);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la modification de la catégorie");
    }
  }

  function startEditCategory(categoryName: string) {
    setEditingCategory(categoryName);
    setEditCategoryName(categoryName);
  }

  function cancelEditCategory() {
    setEditingCategory(null);
    setEditCategoryName("");
  }

  function toggleTheme() {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  }

  async function handleCreateReminder(noteId: string) {
    if (!reminderDateTime) {
      setEditError("Veuillez sélectionner une date et une heure.");
      return;
    }
    const timestamp = new Date(reminderDateTime).getTime();
    if (timestamp <= Date.now()) {
      setEditError("La date doit être dans le futur.");
      return;
    }
    setLoadingReminder(true);
    setEditError(null);
    try {
      const response = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, reminderDate: timestamp })
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Erreur lors de la création du rappel");
      }
      await loadReminders();
      setReminderNoteId(null);
      setReminderDateTime("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoadingReminder(false);
    }
  }

  async function handleDeleteReminder(reminderId: string) {
    try {
      const response = await fetch("/api/reminders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderId })
      });
      if (response.ok) {
        await loadReminders();
      }
    } catch (err) {
      console.error("Erreur lors de la suppression du rappel:", err);
    }
  }


  return (
    <>
      <Head>
        <title>MindLyst · Tableau de bord</title>
      </Head>
      <main className="min-h-screen px-6 py-10 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/"
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                  title="Retour au menu"
                >
                  ← Retour
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Bonjour, {user.email}</h1>
              <p className="text-slate-600 dark:text-slate-400">Ajoutez une nouvelle note et organisez vos idées.</p>
              {notesRemainingToday !== null && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <span className="text-sm font-medium text-green-600">
                        🔓 Mode Admin - Notes illimitées
                      </span>
                    ) : (
                      <>
                        <span className={`text-sm font-medium ${notesRemainingToday === 0 ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                          {notesRemainingToday === 0 ? "❌ Limite atteinte aujourd'hui" : `📝 ${notesRemainingToday} note(s) restante(s) aujourd'hui`}
                        </span>
                        {userPlan === "free" && notesRemainingToday === 0 && (
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch("/api/subscription/create-checkout", {
                                  method: "POST",
                                });
                                if (!response.ok) {
                                  const error = await response.json();
                                  alert(error.error || "Erreur lors de la création du checkout");
                                  return;
                                }
                                const { url } = await response.json();
                                if (url) {
                                  window.location.href = url;
                                }
                              } catch (error) {
                                console.error("Erreur:", error);
                                alert("Erreur lors de la redirection vers le paiement");
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                          >
                            Passer à Pro (9€/mois) →
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {!isAdmin && (
                    <button
                      onClick={() => setShowAdminForm(!showAdminForm)}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:underline"
                    >
                      {showAdminForm ? "Masquer" : "Afficher"} le code admin
                    </button>
                  )}
                  {showAdminForm && !isAdmin && (
                    <div className="flex gap-2 items-center p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
                      <input
                        type="text"
                        value={adminCode}
                        onChange={(e) => setAdminCode(e.target.value)}
                        placeholder="Code admin..."
                        className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                        onKeyPress={(e) => e.key === "Enter" && handleActivateAdmin()}
                      />
                      <button
                        onClick={handleActivateAdmin}
                        className="rounded-md bg-green-600 text-white px-3 py-1 text-sm font-medium hover:bg-green-700 transition"
                      >
                        Activer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleTheme}
                className="self-start rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
                title={theme === "light" ? "Passer en mode sombre" : "Passer en mode clair"}
              >
                {theme === "light" ? "🌙" : "☀️"}
              </button>
              {userPlan === "free" && (
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch("/api/subscription/create-checkout", {
                        method: "POST",
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        alert(error.error || "Erreur lors de la création du checkout");
                        return;
                      }
                      const { url } = await response.json();
                      if (url) {
                        window.location.href = url;
                      }
                    } catch (error) {
                      console.error("Erreur:", error);
                      alert("Erreur lors de la redirection vers le paiement");
                    }
                  }}
                  className="self-start rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                >
                  Passer à Pro (9€/mois)
                </button>
              )}
              <button
                onClick={handleLogout}
                className="self-start rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition"
              >
                Se déconnecter
              </button>
            </div>
          </header>

          {/* Section des rappels à venir (en haut de l'écran) */}
          {Object.keys(reminders).length > 0 && (() => {
            const allReminders: Array<{ noteId: string; reminderId: string; reminderDate: number; noteTitle: string }> = [];
            Object.entries(reminders).forEach(([noteId, reminderList]) => {
              const note = notes.find(n => n.id === noteId);
              reminderList.forEach(reminder => {
                allReminders.push({
                  noteId,
                  reminderId: reminder.id,
                  reminderDate: reminder.reminderDate,
                  noteTitle: note?.title || "Note"
                });
              });
            });
            
            // Trier par date (plus proche en premier)
            const upcomingReminders = allReminders
              .filter(r => r.reminderDate > Date.now())
              .sort((a, b) => a.reminderDate - b.reminderDate)
              .slice(0, 5); // Limiter à 5 rappels les plus proches
            
            if (upcomingReminders.length === 0) return null;
            
            return (
              <section className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  🔔 Rappels à venir
                </h2>
                <div className="grid gap-3">
                  {upcomingReminders.map(({ noteId, reminderId, reminderDate, noteTitle }) => {
                    const note = notes.find(n => n.id === noteId);
                    const isExpanded = expandedNotes.has(noteId);
                    return (
                      <div
                        key={reminderId}
                        className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-lg p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🔔</span>
                              <h3 className="text-base font-semibold text-slate-900 dark:text-white">{noteTitle}</h3>
                            </div>
                            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                              {new Intl.DateTimeFormat("fr-FR", { 
                                dateStyle: "full", 
                                timeStyle: "short" 
                              }).format(new Date(reminderDate))}
                            </p>
                            {note && (
                              <button
                                onClick={() => {
                                  setExpandedNotes(prev => {
                                    const next = new Set(prev);
                                    if (next.has(noteId)) {
                                      next.delete(noteId);
                                    } else {
                                      next.add(noteId);
                                    }
                                    return next;
                                  });
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2"
                              >
                                {isExpanded ? "Masquer" : "Voir"} la note
                              </button>
                            )}
                            {isExpanded && note && (
                              <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.text}</p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteReminder(reminderId)}
                            className="ml-4 flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                            title="Supprimer ce rappel"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })()}

          {/* Section Intégrations - Simplifiée */}
          {integrations.length === 0 || !integrations.find((i) => i.enabled) ? (
            <section className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl p-6 opacity-75">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-2xl">
                  🔗
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                    Connecte ton calendrier
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    Quand tu crées une note avec une date pour bientôt (dans les 7 prochains jours), elle est automatiquement ajoutée à ton calendrier.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mb-4 italic">
                    ⏳ Cette fonctionnalité arrive bientôt !
                  </p>
                  <button
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-400 dark:bg-slate-600 text-white rounded-lg font-medium cursor-not-allowed opacity-60"
                  >
                    <span>📅</span>
                    Connecter Google Calendar
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📅</span>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">Google Calendar connecté</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tes notes avec dates sont ajoutées automatiquement
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => disconnectIntegration("google_calendar")}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                  title="Déconnecter"
                >
                  ✕
                </button>
              </div>
            </section>
          )}

          {isAdmin && (
            <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    🔐 Tableau de bord administrateur
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Consulte la liste des comptes inscrits et recherche un pseudo pour obtenir l'adresse e-mail correspondante.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-700/50 text-sm text-slate-700 dark:text-slate-200 space-y-1 min-w-[220px]">
                  <p className="font-semibold">
                    Comptes créés :{" "}
                    {adminTotalUsers !== null ? adminTotalUsers.toLocaleString("fr-FR") : "—"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Résultats affichés :{" "}
                    {adminUserCount !== null ? adminUserCount.toLocaleString("fr-FR") : "—"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="admin-search" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rechercher un pseudo
                  </label>
                  <input
                    id="admin-search"
                    type="search"
                    value={adminSearch}
                    onChange={(event) => setAdminSearch(event.target.value)}
                    placeholder="Exemple : coach_pro, mindlyst_team..."
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Astuce : laisse le champ vide pour afficher tous les comptes récents.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminUsers(adminSearch)}
                  disabled={adminUsersLoading}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                    adminUsersLoading
                      ? "bg-slate-300 text-slate-600 dark:bg-slate-600 dark:text-slate-300 cursor-wait"
                      : "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
                  }`}
                >
                  {adminUsersLoading ? "Chargement..." : "Actualiser"}
                </button>
              </div>

              {adminUsersError && (
                <div className="rounded-md border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {adminUsersError}
                </div>
              )}

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.3fr,1.8fr,1.2fr,0.9fr] gap-4 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50">
                  <span>Pseudo</span>
                  <span>Email</span>
                  <span>Date d'inscription</span>
                  <span>Statut</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {adminUsersLoading && adminUsers.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">Chargement des utilisateurs...</p>
                  ) : adminUsers.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300">Aucun utilisateur trouvé pour cette recherche.</p>
                  ) : (
                    adminUsers.map((adminUser) => (
                      <div
                        key={adminUser.id}
                        className="px-4 py-3 grid gap-3 md:grid-cols-[1.3fr,1.8fr,1.2fr,0.9fr] md:items-center"
                      >
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{adminUser.username}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 break-all">ID : {adminUser.id}</p>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 break-all">{adminUser.email}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(adminUser.createdAt))}
                        </div>
                        <div className="text-xs font-semibold">
                          {adminUser.isAdmin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 text-emerald-700 dark:text-emerald-300">
                              ⭐ Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700/40 px-2 py-1 text-slate-600 dark:text-slate-300">
                              👤 Utilisateur
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
              >
                ✕ Fermer
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-sm font-medium"
            >
              {showCreateForm ? "▼" : "▶"} {showCreateForm ? "Masquer" : "Afficher"} le formulaire
            </button>
          </div>
          {showCreateForm && (
            <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-6 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Nouvelle note</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Ajoute une date dans ta note pour qu'elle soit automatiquement ajoutée à ton calendrier
                </p>
              </div>
              <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label htmlFor="note-title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Titre
                </label>
                <input
                  id="note-title"
                  type="text"
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  placeholder="Titre de la note..."
                />
              </div>
              <div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="note-text" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Contenu
                    </label>
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm ${
                        isRecording
                          ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                          : "bg-purple-500 text-white hover:bg-purple-600"
                      }`}
                      title={isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement vocal"}
                    >
                      {isRecording ? (
                        <>
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          🎤
                          Dictée
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    id="note-text"
                    value={text}
                    onChange={event => setText(event.target.value)}
                    rows={5}
                    required
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition resize-none"
                    placeholder={isRecording ? "Parlez maintenant... (le texte apparaîtra automatiquement)" : "Ex: Rendez-vous client le 15 janvier 2024 à 14h30..."}
                  />
                  {isRecording && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      Enregistrement en cours... Parlez clairement.
                    </p>
                  )}
                  {!isRecording && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      💡 Astuce : Ajoute une date dans ta note (ex: "le 15 janvier à 14h") pour qu'elle soit ajoutée à ton calendrier
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 sm:items-end sm:justify-between pt-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Catégorie
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={category}
                      onChange={event => setCategory(event.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      className="px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                      title="Gérer les catégories"
                    >
                      ⚙️
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-lg transition shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? "Enregistrement…" : "Créer la note"}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </form>
          </section>
          )}

          {/* Partages créés par l'utilisateur */}
          {ownedShares.length > 0 && (
            <section className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-200">📤 Notes que j'ai partagées</h2>
              <div className="grid gap-4">
                {ownedShares.map(({ shareId, noteTitle, sharedWithUsername, sharedWithEmail, permission }) => (
                  <article
                    key={shareId}
                    className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded-lg shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{noteTitle}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                          Partagée avec : <span className="font-medium">@{sharedWithUsername}</span>
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Permission : {permission === "write" ? "Modification" : "Lecture seule"}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log("🖱️ Clic sur supprimer partage, shareId:", shareId);
                          handleDeleteOwnedShare(shareId);
                        }}
                        className="ml-4 flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline text-sm"
                        title="Supprimer ce partage"
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Notes partagées reçues */}
          {sharedNotesWithShareId.length > 0 && (
            <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 space-y-4">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200">📥 Notes partagées avec moi</h2>
              <div className="grid gap-4">
                {sharedNotesWithShareId.map(({ note, shareId }) => (
                  <article
                    key={note.id}
                    className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{note.title}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">{note.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="capitalize bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                            {note.category}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            <FormattedDate timestamp={note.createdAt} />
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSharedNote(shareId)}
                        className="ml-4 flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline text-sm"
                        title="Supprimer cette note partagée"
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <FilterPill label="toutes" active={filter === "toutes"} onClick={() => setFilter("toutes")} />
              {categories.map(cat => (
                <FilterPill key={cat} label={cat} active={filter === cat} onClick={() => setFilter(cat)} />
              ))}
            </div>
            {/* Section des notes avec rappels (toujours en priorité) */}
            {filteredNotes.filter(note => reminders[note.id] && reminders[note.id].length > 0).length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  🔔 Notes avec rappels (priorité)
                </h2>
                <div className="grid gap-4">
                  {filteredNotes
                    .filter(note => reminders[note.id] && reminders[note.id].length > 0)
                    .map(note => {
                      const isExpanded = expandedNotes.has(note.id);
                      const isEditing = editingNoteId === note.id;
                      return (
                        <article
                          key={note.id}
                          className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg shadow-sm overflow-hidden"
                        >
                          <header
                            className="px-4 py-3 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition"
                            onClick={() => {
                              if (!isEditing) {
                                setExpandedNotes(prev => {
                                  const next = new Set(prev);
                                  if (next.has(note.id)) {
                                    next.delete(note.id);
                                  } else {
                                    next.add(note.id);
                                  }
                                  return next;
                                });
                              }
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                {!isEditing ? (
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{note.title}</h3>
                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                                      🔔 {reminders[note.id]?.length || 0} rappel{reminders[note.id]?.length > 1 ? 's' : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editTitle}
                                      onChange={e => setEditTitle(e.target.value)}
                                      className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                      placeholder="Titre..."
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={editCategory}
                                        onChange={e => setEditCategory(e.target.value as NoteCategory)}
                                        className="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        {categories.map(cat => (
                                          <option key={cat} value={cat}>
                                            {cat}
                                          </option>
                                        ))}
                                      </select>
                                      <span className="text-xs text-slate-500 dark:text-slate-400">
                                        <FormattedDate timestamp={note.createdAt} />
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                {!isEditing ? (
                                  <>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSharingNoteId(note.id);
                                        setShareUsername("");
                                      }}
                                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
                                      title="Partager cette note"
                                    >
                                      🔗
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setReminderNoteId(note.id);
                                        const now = new Date();
                                        now.setMinutes(now.getMinutes() + 60);
                                        setReminderDateTime(now.toISOString().slice(0, 16));
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                      title="Ajouter un rappel"
                                    >
                                      🔔
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        startEdit(note);
                                      }}
                                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline"
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleDelete(note.id);
                                      }}
                                      className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline"
                                    >
                                      Supprimer
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleUpdate(note.id);
                                      }}
                                      disabled={loading}
                                      className="text-sm text-green-600 hover:text-green-700 hover:underline disabled:opacity-60"
                                    >
                                      {loading ? "Sauvegarde..." : "Sauvegarder"}
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        cancelEdit();
                                      }}
                                      disabled={loading}
                                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline disabled:opacity-60"
                                    >
                                      Annuler
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </header>
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                              {!isEditing ? (
                                <>
                                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-4">{note.text}</p>
                                  {reminders[note.id] && reminders[note.id].length > 0 && (
                                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Rappels programmés :</p>
                                      <div className="space-y-2">
                                        {reminders[note.id].map(reminder => (
                                          <div key={reminder.id} className="flex items-center justify-between text-sm">
                                            <span className="text-blue-700 dark:text-blue-300">
                                              🔔 {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(reminder.reminderDate))}
                                            </span>
                                            <div className="flex gap-2">
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  setSharingReminderId(reminder.id);
                                                  setShareUsername("");
                                                  setSearchQuery("");
                                                  setSearchResults([]);
                                                }}
                                                className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline text-xs"
                                                title="Partager ce rappel"
                                              >
                                                🔗 Partager
                                              </button>
                                              <button
                                                onClick={e => {
                                                  e.stopPropagation();
                                                  handleDeleteReminder(reminder.id);
                                                }}
                                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline text-xs"
                                              >
                                                Supprimer
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  rows={6}
                                  className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                  placeholder="Contenu de la note..."
                                  onClick={e => e.stopPropagation()}
                                />
                              )}
                              {isEditing && editError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{editError}</p>}
                            </div>
                          )}
                        </article>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Section des autres notes */}
            <div>
              {filteredNotes.filter(note => !reminders[note.id] || reminders[note.id].length === 0).length > 0 ? (
                <>
                  {filteredNotes.filter(note => reminders[note.id] && reminders[note.id].length > 0).length > 0 && (
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-3">Autres notes</h2>
                  )}
                  <div className="grid gap-4">
                    {filteredNotes
                      .filter(note => !reminders[note.id] || reminders[note.id].length === 0)
                      .map(note => {
                        const isExpanded = expandedNotes.has(note.id);
                        const isEditing = editingNoteId === note.id;
                        return (
                          <article
                            key={note.id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden"
                          >
                            <header
                              className={`flex items-center justify-between p-4 ${!isEditing ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700" : ""} transition`}
                              onClick={!isEditing ? () => toggleNote(note.id) : undefined}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex-shrink-0">
                                  <svg
                                    className={`w-5 h-5 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  {!isEditing ? (
                                    <>
                                      <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">{note.title}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${
                                          note.category === "urgent"
                                            ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                                            : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                        }`}>
                                          {note.category === "urgent" ? "🔴 urgent" : note.category}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          <FormattedDate timestamp={note.createdAt} />
                                        </span>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="w-full">
                                      <input
                                        type="text"
                                        value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400 mb-2"
                                        placeholder="Titre..."
                                        onClick={e => e.stopPropagation()}
                                      />
                                      <div className="flex items-center gap-2">
                                        <select
                                          value={editCategory}
                                          onChange={e => setEditCategory(e.target.value as NoteCategory)}
                                          className="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          {categories.map(cat => (
                                            <option key={cat} value={cat}>
                                              {cat}
                                            </option>
                                          ))}
                                        </select>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                          <FormattedDate timestamp={note.createdAt} />
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                {!isEditing ? (
                                  <>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSharingNoteId(note.id);
                                        setShareUsername("");
                                      }}
                                      className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline"
                                      title="Partager cette note"
                                    >
                                      🔗
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setReminderNoteId(note.id);
                                        const now = new Date();
                                        now.setMinutes(now.getMinutes() + 60); // Par défaut dans 1h
                                        setReminderDateTime(now.toISOString().slice(0, 16));
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                      title="Ajouter un rappel"
                                    >
                                      🔔
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        startEdit(note);
                                      }}
                                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline"
                                    >
                                      Modifier
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleDelete(note.id);
                                      }}
                                      className="text-sm text-red-600 hover:text-red-700 hover:underline"
                                    >
                                      Supprimer
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        handleUpdate(note.id);
                                      }}
                                      disabled={loading}
                                      className="text-sm text-green-600 hover:text-green-700 hover:underline disabled:opacity-60"
                                    >
                                      {loading ? "Sauvegarde..." : "Sauvegarder"}
                                    </button>
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        cancelEdit();
                                      }}
                                      disabled={loading}
                                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:underline disabled:opacity-60"
                                    >
                                      Annuler
                                    </button>
                                  </>
                                )}
                              </div>
                            </header>
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700">
                                {!isEditing ? (
                                  <>
                                    <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-4">{note.text}</p>
                                    {reminders[note.id] && reminders[note.id].length > 0 && (
                                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                                        <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Rappels programmés :</p>
                                        <div className="space-y-2">
                                          {reminders[note.id].map(reminder => (
                                            <div key={reminder.id} className="flex items-center justify-between text-sm">
                                              <span className="text-blue-700 dark:text-blue-300">
                                                🔔 {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(reminder.reminderDate))}
                                              </span>
                                              <div className="flex gap-2">
                                                <button
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    setSharingReminderId(reminder.id);
                                                    setShareUsername("");
                                                    setSearchQuery("");
                                                    setSearchResults([]);
                                                  }}
                                                  className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline text-xs"
                                                  title="Partager ce rappel"
                                                >
                                                  🔗 Partager
                                                </button>
                                                <button
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    handleDeleteReminder(reminder.id);
                                                  }}
                                                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline text-xs"
                                                >
                                                  Supprimer
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <textarea
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    rows={6}
                                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                    placeholder="Contenu de la note..."
                                    onClick={e => e.stopPropagation()}
                                  />
                                )}
                                {isEditing && editError && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{editError}</p>}
                              </div>
                            )}
                          </article>
                        );
                      })}
                  </div>
                </>
              ) : (
                filteredNotes.filter(note => reminders[note.id] && reminders[note.id].length > 0).length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                    Aucune note pour ce filtre.
                  </div>
                )
              )}
            </div>
          </section>
        </div>

        {/* Modal pour gérer les catégories */}
        {showCategoryManager && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCategoryManager(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Gérer les catégories</h3>
                <button
                  onClick={() => setShowCategoryManager(false)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {/* Ajouter une nouvelle catégorie */}
                <div>
                  <label htmlFor="new-category" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ajouter une catégorie
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="new-category"
                      type="text"
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder="Nom de la catégorie..."
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      onKeyPress={e => e.key === "Enter" && handleAddCategory()}
                    />
                    <button
                      onClick={handleAddCategory}
                      className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Liste des catégories */}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Catégories disponibles</p>
                  <div className="space-y-2">
                    {categories.map(cat => {
                      const isDefault = DEFAULT_CATEGORIES.includes(cat);
                      const isEditing = editingCategory === cat;
                      return (
                        <div
                          key={cat}
                          className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700 rounded-md"
                        >
                          {isEditing ? (
                            <>
                              <input
                                type="text"
                                value={editCategoryName}
                                onChange={e => setEditCategoryName(e.target.value)}
                                className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                                onKeyPress={e => {
                                  if (e.key === "Enter") {
                                    handleUpdateCategory(cat, editCategoryName);
                                  } else if (e.key === "Escape") {
                                    cancelEditCategory();
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateCategory(cat, editCategoryName)}
                                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditCategory}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 capitalize">
                                {cat}
                                {isDefault && (
                                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(par défaut)</span>
                                )}
                              </span>
                              {!isDefault && (
                                <>
                                  <button
                                    onClick={() => startEditCategory(cat)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                                    title="Modifier"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(cat)}
                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
                                    title="Supprimer"
                                  >
                                    🗑️
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Modal pour partager un rappel */}
        {sharingReminderId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSharingReminderId(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Partager le rappel</h3>
                <button
                  onClick={() => setSharingReminderId(null)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {/* Recherche d'utilisateurs */}
                <div>
                  <label htmlFor="search-share-reminder" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rechercher un utilisateur
                  </label>
                  <input
                    id="search-share-reminder"
                    type="text"
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        handleSearchUsers();
                      } else {
                        setSearchResults([]);
                      }
                    }}
                    placeholder="Rechercher par pseudo..."
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  />
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                        >
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">@{user.username}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                          </div>
                          <button
                            onClick={() => {
                              setShareUsername(user.username);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Sélectionner
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Partager avec un utilisateur */}
                <div>
                  <label htmlFor="share-username-reminder" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Partager avec (pseudo)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="share-username-reminder"
                      type="text"
                      value={shareUsername}
                      onChange={e => setShareUsername(e.target.value)}
                      placeholder="@pseudo"
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      onKeyPress={e => e.key === "Enter" && handleShareReminder(sharingReminderId)}
                    />
                    <select
                      value={sharePermission}
                      onChange={e => setSharePermission(e.target.value as "read" | "write")}
                      className="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-2 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                    >
                      <option value="read">Lecture seule</option>
                      <option value="write">Modification</option>
                    </select>
                    <button
                      onClick={() => handleShareReminder(sharingReminderId)}
                      className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Partager
                    </button>
                  </div>
                </div>

                {/* Liste des contacts */}
                {contacts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Mes contacts :</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setShareUsername(contact.username);
                          }}
                          className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >
                          @{contact.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Modal pour partager une note */}
        {sharingNoteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSharingNoteId(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Partager la note</h3>
                <button
                  onClick={() => setSharingNoteId(null)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {/* Recherche d'utilisateurs */}
                <div>
                  <label htmlFor="search-share" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rechercher un utilisateur
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="search-share"
                      type="text"
                      value={searchQuery}
                      onChange={e => {
                        setSearchQuery(e.target.value);
                        if (e.target.value.trim()) {
                          handleSearchUsers();
                        } else {
                          setSearchResults([]);
                        }
                      }}
                      placeholder="Rechercher par pseudo..."
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                    />
                  </div>
                  {/* Résultats de recherche */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                        >
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white text-sm">@{user.username}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{user.email}</div>
                          </div>
                          <button
                            onClick={() => {
                              setShareUsername(user.username);
                              setSearchQuery("");
                              setSearchResults([]);
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                          >
                            Sélectionner
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Partager avec un utilisateur */}
                <div>
                  <label htmlFor="share-username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Partager avec (pseudo)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="share-username"
                      type="text"
                      value={shareUsername}
                      onChange={e => setShareUsername(e.target.value)}
                      placeholder="@pseudo ou email"
                      className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                      onKeyPress={e => e.key === "Enter" && handleShareNote(sharingNoteId)}
                    />
                    <select
                      value={sharePermission}
                      onChange={e => setSharePermission(e.target.value as "read" | "write")}
                      className="rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-2 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                    >
                      <option value="read">Lecture seule</option>
                      <option value="write">Modification</option>
                    </select>
                    <button
                      onClick={() => handleShareNote(sharingNoteId)}
                      className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Partager
                    </button>
                  </div>
                </div>

                {/* Liste des contacts */}
                {contacts.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Mes contacts :</p>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => {
                            setShareUsername(contact.username);
                          }}
                          className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                        >
                          @{contact.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Créer un lien public */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Lien public
                  </label>
                  {publicShareLinks[sharingNoteId] ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={publicShareLinks[sharingNoteId]}
                          readOnly
                          className="flex-1 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => handleCopyLink(publicShareLinks[sharingNoteId])}
                          className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 transition"
                        >
                          Copier
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Toute personne avec ce lien peut voir la note
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCreatePublicLink(sharingNoteId)}
                      className="w-full rounded-md bg-purple-600 text-white px-4 py-2 text-sm font-medium hover:bg-purple-700 transition"
                    >
                      Créer un lien public
                    </button>
                  )}
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Modal pour créer un rappel */}
        {reminderNoteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setReminderNoteId(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Créer un rappel</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="reminder-datetime" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Date et heure du rappel
                  </label>
                  <input
                    id="reminder-datetime"
                    type="datetime-local"
                    value={reminderDateTime}
                    onChange={e => setReminderDateTime(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-400"
                  />
                </div>
                {editError && <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => {
                      setReminderNoteId(null);
                      setReminderDateTime("");
                      setEditError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleCreateReminder(reminderNoteId)}
                    disabled={loadingReminder}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md disabled:opacity-60"
                  >
                    {loadingReminder ? "Création..." : "Créer le rappel"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function FilterPill({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition ${
        active
          ? "bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-700"
          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

// Composant pour formater la date uniquement côté client (évite l'erreur d'hydratation)
function FormattedDate({ timestamp }: { timestamp: number }) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    const date = new Date(timestamp);
    const formattedDate = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
    setFormatted(formattedDate);
  }, [timestamp]);

  return <span>{formatted || "—"}</span>;
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async context => {
  const cookies = parseCookies({ headers: { cookie: context.req.headers.cookie } });
  const token = cookies[COOKIE_NAME];
  if (!token) {
    return {
      redirect: {
        destination: "/login",
        permanent: false
      }
    };
  }
  const session = await getSession(token);
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false
      }
    };
  }

  const users = await readUsers();
  const user = users.find(u => u.id === session.userId);
  if (!user) {
    return {
      redirect: {
        destination: "/login",
        permanent: false
      }
    };
  }

  // Migration automatique : ajouter un pseudo si l'utilisateur n'en a pas
  if (!user.username) {
    user.username = user.email.split("@")[0];
    const userIndex = users.findIndex((u) => u.id === user.id);
    if (userIndex !== -1) {
      users[userIndex].username = user.username;
      const { writeUsers } = await import("@/lib/auth");
      await writeUsers(users);
    }
  }

  const notes = await readJson<Note[]>("notes.json", []);
  // Migration : ajouter un titre par défaut pour les anciennes notes sans titre
  const notesWithTitle = notes.map(note => ({
    ...note,
    title: (note as any).title || "Note sans titre"
  }));
  const userNotes = notesWithTitle.filter(note => note.userId === user.id).sort((a, b) => b.createdAt - a.createdAt);

  return {
    props: {
      user: { id: user.id, email: user.email },
      notes: userNotes
    }
  };
};

