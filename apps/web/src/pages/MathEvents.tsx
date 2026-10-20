import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Swords, X } from "lucide-react";
import api from "../lib/api/client";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "../lib/toast";
import { bogotaInputToIso } from "../lib/datetime";
import { registerAppWorker } from "../lib/pwa";
import { DuelStage, type DuelState, type AnswerFeedback } from "./math-events/DuelStage";
import { useDuelAudio } from "./math-events/useDuelAudio";
import { Reactions, RecognitionSummary, type Recognition } from "./math-events/Reactions";

type EventCard = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  avatarCode: string;
  dailyMatchLimit: number;
};
type Person = {
  id: string;
  firstName: string;
  lastName: string;
  course: string;
  grade: number;
  avatarCode: string;
  available: boolean;
  inMatch: boolean;
  hasPendingInvite?: boolean;
};
type Board = {
  event: {
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    endsAt: string;
    gradeNumbers: number[];
    dailyMatchLimit: number;
    showCorrectAnswers: boolean;
    showExplanations: boolean;
  };
  me: {
    enrollmentId: string;
    avatarCode: string;
    firstName: string;
    lastName: string;
    course: string;
    grade: number;
    matchesUsedToday: number;
    matchesRemaining: number;
  };
  roster: Person[];
  duels: any[];
};
type Duel = DuelState;
const avatars = [
  "star",
  "fox",
  "rocket",
  "tiger",
  "owl",
  "cat",
  "bear",
  "dolphin",
  "dragon",
  "panda",
  "lion",
  "koala",
];
const avatarGlyph: Record<string, string> = {
  star: "⭐",
  fox: "🦊",
  rocket: "🚀",
  tiger: "🐯",
  owl: "🦉",
  cat: "🐱",
  bear: "🐻",
  dolphin: "🐬",
  dragon: "🐲",
  panda: "🐼",
  lion: "🦁",
  koala: "🐨",
};
function toApplicationServerKey(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = window.atob(
    base64.padEnd(Math.ceil(base64.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
const fmt = (s: string) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(new Date(s));

export function MathEventInvitation() {
  const { user } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const role = user?.roles?.some(
      (r: any) => (r?.role?.name || r) === "ESTUDIANTE",
    );
    if (!role || loc.pathname.startsWith("/eventos")) return;
    let live = true;
    api
      .get<EventCard[]>("/math-events/active")
      .then((r) => {
        if (!live) return;
        setEvents(r.data);
        const pending = r.data.find(
          (e) =>
            localStorage.getItem(`edusyn:event-invite:${e.id}`) !== "dismissed",
        );
        setShow(!!pending);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user?.id, loc.pathname]);
  const event = events.find(
    (e) => localStorage.getItem(`edusyn:event-invite:${e.id}`) !== "dismissed",
  );
  if (!show || dismissed || !event) return null;
  const close = () => {
    localStorage.setItem(`edusyn:event-invite:${event.id}`, "dismissed");
    setDismissed(true);
    setShow(false);
  };
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="math-event-title"
    >
      <section className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
        <button
          onClick={close}
          className="absolute right-3 top-3 rounded-full p-2 text-slate-500"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-100 text-3xl">
          🧮
        </div>
        <p className="text-xs font-extrabold uppercase tracking-widest text-blue-700">
          Evento del colegio
        </p>
        <h2
          id="math-event-title"
          className="mt-1 text-2xl font-black text-slate-950"
        >
          {event.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {event.description ||
            "Reta a tus compañeros, resuelve desafíos y consulta la clasificación del evento."}
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Cierra {fmt(event.endsAt)}
        </p>
        <button
          onClick={() => {
            localStorage.setItem(
              `edusyn:event-invite:${event.id}`,
              "dismissed",
            );
            navigate(`/eventos/${event.id}`);
          }}
          className="mt-5 min-h-12 w-full rounded-xl bg-blue-700 px-4 font-bold text-white"
        >
          ¡Quiero participar!
        </button>
        <button
          onClick={close}
          className="mt-2 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-slate-600"
        >
          Ahora no
        </button>
      </section>
    </div>
  );
}

export default function MathEventsPage() {
  const { eventId } = useParams();
  const nav = useNavigate();
  const [events, setEvents] = useState<EventCard[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [tab, setTab] = useState<"play" | "ranking" | "profile">("play");
  const [duel, setDuel] = useState<Duel | null>(null);
  const [ranking, setRanking] = useState<any>(null);
  const [scope, setScope] = useState<"general" | "grade" | "course">("general");
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [hiddenDuelId, setHiddenDuelId] = useState<string | null>(null);
  const duelOpponents = useRef<Record<string, Person>>({});
  const answerInFlight = useRef(false);
  const announcedInvites = useRef(new Set<string>());
  const invitationReadiness = useRef(new Map<string, boolean>());
  const [available, setAvailable] = useState(false);
  const [pushKey, setPushKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reacting, setReacting] = useState(false);
  const [recognitions, setRecognitions] = useState<Record<string, Recognition>>({});
  const reactionInFlight = useRef(false);
  const reactionRevision = useRef(0);
  const recognitionEvent = useRef(eventId);
  recognitionEvent.current = eventId;
  useEffect(() => { setRecognitions({}); setRanking(null); reactionRevision.current++; }, [eventId]);
  const audio = useDuelAudio(!!stageId && !!duel && !duel.finished && !feedback);
  const playedCues = useRef(new Set<string>());
  useEffect(() => {
    if (!duel) return;
    const key = `${duel.id}:${duel.allDone ? "end" : "start"}`;
    if (playedCues.current.has(key)) return;
    playedCues.current.add(key);
    if (duel.allDone) audio.cue(duel.myScore > (duel.opponentScore ?? 0) ? "win" : "finish");
    else if (!duel.questions.some(q => q.answered)) audio.cue("start");
  }, [duel?.id, duel?.allDone, audio.cue]);
  useEffect(() => {
    document.body.setAttribute("data-math-event-app", "");
    return () => document.body.removeAttribute("data-math-event-app");
  }, []);
  const loadEvents = useCallback(async () => {
    try {
      const r = await api.get<EventCard[]>("/math-events/active");
      setEvents(r.data);
    } catch (e) {
      setError("No pudimos cargar los eventos ahora.");
    }
  }, []);
  const loadBoard = useCallback(async () => {
    if (!eventId) return;
    try {
      const r = await api.get<Board>(`/math-events/${eventId}`);
      for (const d of r.data.duels) duelOpponents.current[d.id] = d.opponent;
      setBoard(r.data);
      setError("");
    } catch (e) {
      setError("No pudimos abrir el evento. Vuelve a intentarlo.");
    }
  }, [eventId]);
  const loadDuel = useCallback(async (id: string) => {
    try {
      const r = await api.get<Duel>(`/math-events/duels/${id}`);
      setDuel(r.data);
    } catch {
      setDuel(null);
    }
  }, []);
  useEffect(() => {
    if (!eventId) {
      loadEvents();
      return;
    }
    api
      .get<{ publicKey: string | null }>(`/math-events/${eventId}/push/config`)
      .then((r) => setPushKey(r.data.publicKey))
      .catch(() => setPushKey(null));
    api
      .post(`/math-events/${eventId}/join`, {})
      .then(() => loadBoard())
      .catch(() => loadBoard());
  }, [eventId, loadEvents, loadBoard]);
  useEffect(() => {
    if (!eventId) return;
    const t = window.setInterval(() => {
      if (!document.hidden && !stageId) void loadBoard();
    }, 9000);
    return () => clearInterval(t);
  }, [eventId, loadBoard, stageId]);
  useEffect(() => {
    if (!eventId || !available) return;
    api
      .put(`/math-events/${eventId}/presence`, { available: true })
      .catch(() => {});
    const t = window.setInterval(
      () =>
        api
          .put(`/math-events/${eventId}/presence`, { available: true })
          .catch(() => {}),
      18000,
    );
    return () => {
      clearInterval(t);
      api
        .put(`/math-events/${eventId}/presence`, { available: false })
        .catch(() => {});
    };
  }, [eventId, available]);
  useEffect(() => {
    let live = true;
    if ((tab === "ranking" || duel?.allDone) && eventId)
      api
        .get(`/math-events/${eventId}/ranking`, { params: { scope } })
        .then((r) => { if (live) setRanking(r.data); })
        .catch(() => { if (live) toast.error("No pudimos cargar la clasificación."); });
    return () => { live = false; };
  }, [tab, eventId, scope, board?.me.matchesUsedToday, duel?.allDone]);
  useEffect(() => {
    const active = board?.duels?.find((d: any) => d.status === "ACTIVE");
    if (active) loadDuel(active.id);
    else if (duel && !duel.allDone) loadDuel(duel.id);
  }, [board?.duels, loadDuel, duel?.id, duel?.allDone]);
  useEffect(() => {
    if (duel && duel.id !== hiddenDuelId) setStageId(duel.id);
  }, [duel?.id, hiddenDuelId]);
  useEffect(() => {
    for (const invitation of board?.duels ?? []) {
      if (invitation.status === "INVITED" && !invitation.invitedByMe && !announcedInvites.current.has(invitation.id)) {
        announcedInvites.current.add(invitation.id);
        toast.success(`¡${invitation.opponent.firstName} te reta! ${invitation.canAccept === false ? invitation.invitationMessage : "Puedes aceptar el duelo en el evento."}`);
      }
      if (invitation.status === "INVITED" && !invitation.invitedByMe) {
        const ready = invitation.canAccept === true;
        if (ready && invitationReadiness.current.get(invitation.id) === false)
          toast.success(`El reto con ${invitation.opponent.firstName} ya está listo para aceptar.`);
        invitationReadiness.current.set(invitation.id, ready);
      }
    }
  }, [board?.duels]);
  const waitingId = stageId && board?.duels.find(d => d.id === stageId && d.status === "INVITED") ? stageId : null;
  const finishingId = duel?.finished && !duel.allDone ? duel.id : null;
  useEffect(() => {
    const id = waitingId ?? finishingId;
    if (!id) return;
    let live = true, running = false;
    let timer: number;
    let lastWaitingRefresh = 0;
    const controller = new AbortController();
    const poll = async () => {
      if (!live || running) return;
      clearTimeout(timer);
      if (document.hidden) { timer = window.setTimeout(poll, 6000); return; }
      running = true;
      try {
        const r = await api.get(`/math-events/duels/${id}/state`, { signal: controller.signal });
        if (!live) return;
        if ((r.data.status === "ACTIVE" && waitingId) || r.data.status === "COMPLETED") {
          await loadDuel(id); await loadBoard();
        } else if (r.data.status === "INVITED" && Date.now() - lastWaitingRefresh >= 6000) {
          lastWaitingRefresh = Date.now();
          await loadBoard();
        } else if (!["INVITED", "ACTIVE"].includes(r.data.status)) {
          setStageId(null); await loadBoard();
          toast.success("El reto ya no está pendiente. Puedes elegir otro rival.");
        }
      } catch { /* The regular dashboard refresh remains available after transient errors. */ }
      finally { running = false; if (live) timer = window.setTimeout(poll, 1500); }
    };
    void poll();
    document.addEventListener("visibilitychange", poll);
    return () => { live = false; controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", poll); };
  }, [waitingId, finishingId, loadDuel, loadBoard]);
  const resultOpponentId = duel?.allDone
    ? (board?.duels.find(d => d.id === duel.id)?.opponent?.id ?? duelOpponents.current[duel.id]?.id)
    : null;
  const recognitionIds = [...new Set([board?.me.enrollmentId, ...(ranking?.rows ?? []).map((r: any) => r.id), resultOpponentId].filter(Boolean))].sort().join(",");
  const showRecognitions = tab === "ranking" || (stageId === duel?.id && !!duel?.allDone);
  useEffect(() => {
    if (!eventId || !recognitionIds || !showRecognitions) return;
    let live = true, running = false;
    let timer: number;
    const controller = new AbortController();
    const refresh = async () => {
      if (!live || running) return;
      clearTimeout(timer);
      if (document.hidden || reactionInFlight.current) { timer = window.setTimeout(refresh, 12000); return; }
      running = true;
      const revision = reactionRevision.current;
      try {
        const r = await api.get<{ summaries: Record<string, Recognition> }>(`/math-events/${eventId}/recognitions`, { params: { recipientIds: recognitionIds }, signal: controller.signal });
        if (live && revision === reactionRevision.current && !reactionInFlight.current)
          setRecognitions(previous => ({ ...previous, ...r.data.summaries }));
      } catch { /* Counts already loaded with the ranking remain visible during a connection failure. */ }
      finally { running = false; if (live) timer = window.setTimeout(refresh, 12000); }
    };
    void refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; clearTimeout(timer); controller.abort(); document.removeEventListener("visibilitychange", refresh); };
  }, [eventId, recognitionIds, showRecognitions]);
  const sendReaction = async (recipientEnrollmentId: string, kind: string | null): Promise<boolean> => {
    if (!eventId || reactionInFlight.current) return false;
    audio.unlock();
    reactionInFlight.current = true;
    reactionRevision.current++;
    setReacting(true);
    const ranked = ranking?.rows?.find((r: any) => r.id === recipientEnrollmentId);
    const previous: Recognition = recognitions[recipientEnrollmentId] ?? { reactions: ranked?.reactions ?? {}, myReaction: ranked?.myReaction ?? null };
    const counts = { ...previous.reactions };
    if (previous.myReaction) counts[previous.myReaction] = Math.max(0, (counts[previous.myReaction] ?? 0) - 1);
    if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
    setRecognitions(current => ({ ...current, [recipientEnrollmentId]: { reactions: counts, myReaction: kind } }));
    try {
      const r = await api.put<Recognition>(`/math-events/${eventId}/reactions`, { recipientEnrollmentId, kind });
      if (recognitionEvent.current !== eventId) return false;
      setRecognitions(current => ({ ...current, [recipientEnrollmentId]: { reactions: r.data.reactions, myReaction: r.data.myReaction } }));
      if (kind) audio.cue("reaction");
      toast.success(kind ? "¡Reconocimiento enviado!" : "Retiraste tu reacción.");
      return true;
    } catch (e) {
      if (recognitionEvent.current === eventId) {
        setRecognitions(current => ({ ...current, [recipientEnrollmentId]: previous }));
        toast.error(e);
      }
      return false;
    } finally { reactionInFlight.current = false; setReacting(false); }
  };
  const play = async (
    opponentId: string,
    mode: "DIRECT" | "MATCH" = "DIRECT",
  ) => {
    if (!eventId) return;
    audio.unlock();
    setBusy(true);
    try {
      if (mode === "MATCH") {
        const r = await api.post(`/math-events/${eventId}/matchmake`);
        setStageId(r.data.id);
      } else {
        const r = await api.post(`/math-events/${eventId}/challenges`, {
          opponentEnrollmentId: opponentId,
        });
        setStageId(r.data.id);
      }
      await loadBoard();
      toast.success("Reto enviado.");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  const respond = async (id: string, accept: boolean) => {
    audio.unlock();
    setBusy(true);
    try {
      await api.post(`/math-events/${id}/${accept ? "accept" : "decline"}`);
      await loadBoard();
      if (accept) {
        setHiddenDuelId(null);
        setFeedback(null);
        setStageId(id);
        await loadDuel(id);
      }
    } catch (e) {
      toast.error(e);
      await loadBoard();
    } finally {
      setBusy(false);
    }
  };
  const cancelInvite = async (id: string) => {
    setBusy(true);
    try {
      await api.post(`/math-events/${id}/cancel`);
      await loadBoard();
      setDuel(null);
      setStageId(null);
      toast.success("Reto cancelado.");
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };
  const toggleAvailability = async () => {
    if (available) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    if (
      typeof Notification === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      toast.error(
        "Este navegador no admite avisos Push. Puedes seguir jugando con la página abierta.",
      );
      return;
    }
    if (!pushKey) {
      toast.error(
        "Los avisos del sistema aún no están configurados en el servidor. Tu disponibilidad para jugar sí quedó activa.",
      );
      return;
    }
    try {
      const permission =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      if (permission !== "granted") {
        toast.error(
          "Activa las notificaciones de Edusyn en los ajustes del navegador para recibir retos.",
        );
        return;
      }
      const registration = await registerAppWorker();
      const current = await registration.pushManager.getSubscription();
      const subscription =
        current ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toApplicationServerKey(pushKey),
        }));
      await api.post(
        `/math-events/${eventId}/push/subscription`,
        subscription.toJSON(),
      );
      toast.success("Avisos de retos activados para este dispositivo.");
    } catch {
      toast.error(
        "No pudimos activar los avisos. Revisa el permiso del navegador e inténtalo otra vez.",
      );
    }
  };
  const submit = async (
    q: Duel["questions"][number],
    ordinal: number,
    value: string,
  ) => {
    if (!eventId || !duel || answerInFlight.current) return;
    audio.unlock();
    answerInFlight.current = true;
    setAnswering(true);
    try {
      const r = await api.post(`/math-events/duels/${duel.id}/answers`, {
        ordinal,
        answer: value,
      });
      setFeedback({ ...r.data, duelId: duel.id, ordinal, question: q, selected: value });
      audio.cue(r.data.isCorrect ? "correct" : "wrong");
      await loadDuel(duel.id);
      await loadBoard();
    } catch (e) {
      toast.error(e);
    } finally {
      answerInFlight.current = false;
      setAnswering(false);
    }
  };
  const changeAvatar = async (code: string) => {
    if (!eventId) return;
    try {
      await api.put(`/math-events/${eventId}/avatar`, { avatarCode: code });
      await loadBoard();
    } catch (e) {
      toast.error(e);
    }
  };
  if (!eventId)
    return (
      <main className="mx-auto min-h-dvh w-full min-w-0 max-w-xl bg-slate-50 px-4 py-8">
        <header className="mb-6">
          <Link
            to="/aula"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
          >
            <ArrowLeft size={16} />
            Mis cursos
          </Link>
          <h1 className="mt-5 text-3xl font-black text-slate-950">Eventos</h1>
          <p className="mt-1 text-slate-600">
            Juega, reta y participa en los eventos del colegio.
          </p>
        </header>
        {events.length ? (
          events.map((e) => (
            <button
              key={e.id}
              onClick={() => nav(`/eventos/${e.id}`)}
              className="mb-3 w-full rounded-2xl border border-blue-100 bg-white p-5 text-left shadow-sm"
            >
              <span className="text-xs font-bold uppercase tracking-wide text-blue-700">
                En curso · 6.º a 11.º
              </span>
              <strong className="mt-1 block text-xl font-black">
                {e.title}
              </strong>
              <span className="mt-2 block text-sm text-slate-600">
                {e.description}
              </span>
              <span className="mt-3 block text-xs text-slate-500">
                Termina {fmt(e.endsAt)}
              </span>
            </button>
          ))
        ) : (
          <div className="rounded-2xl bg-white p-6 text-slate-600">
            No hay eventos activos por ahora.
          </div>
        )}
      </main>
    );
  if (error && !board)
    return (
      <main className="mx-auto max-w-xl p-6">
        <Link to="/eventos">← Eventos</Link>
        <p className="mt-6">{error}</p>
        <button
          onClick={loadBoard}
          className="mt-3 rounded-xl bg-blue-700 px-4 py-3 text-white"
        >
          Reintentar
        </button>
      </main>
    );
  if (!board)
    return (
      <div className="grid min-h-screen place-items-center">
        <LoaderCircle className="animate-spin text-blue-700" />
      </div>
    );
  const invites = board.duels.filter(
    (d) => d.status === "INVITED" && !d.invitedByMe,
  );
  const ownInvites = board.duels.filter(
    (d) => d.status === "INVITED" && d.invitedByMe,
  );
  const dateLabel = `${fmt(board.event.startsAt)} – ${fmt(board.event.endsAt)}`;
  return (
    <main className="math-event-page min-h-dvh w-full min-w-0 bg-[#eff4ff] pb-28 text-slate-950">
      <div className="mx-auto w-full min-w-0 max-w-xl px-4 pb-5 pt-4">
        <Link
          to="/eventos"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600"
        >
          <ArrowLeft size={16} />
          Eventos
        </Link>
        <header className="mt-4 rounded-3xl bg-gradient-to-br from-[#164ccd] via-[#2455d7] to-[#5036be] p-5 text-white shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-blue-100">
                Evento del colegio · Matemáticas
              </span>
              <h1 className="mt-1 text-2xl font-black">{board.event.title}</h1>
            </div>
            <span className="text-3xl">🧮</span>
          </div>
          <p className="mt-2 text-sm text-blue-100">{dateLabel}</p>
          <div className="mt-4 flex justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm">
            <span>Partidas puntuables hoy</span>
            <strong>
              {board.me.matchesUsedToday}/{board.event.dailyMatchLimit}
            </strong>
          </div>
        </header>
        {duel && (
          <button onClick={() => { setStageId(duel.id); setHiddenDuelId(null); }} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 font-extrabold text-white shadow-lg">
            <Swords size={20} /> {duel.allDone ? "Ver resultado del duelo" : duel.finished ? "Consultar mi duelo" : "Continuar mi duelo"}
          </button>
        )}
        {!duel && board.duels.some(d => d.status === "COMPLETED") && (
          <button className="mt-4 min-h-12 w-full rounded-xl bg-white p-3 font-bold text-blue-800" onClick={() => {
            const last = board.duels.find(d => d.status === "COMPLETED");
            if (last) { setHiddenDuelId(null); setStageId(last.id); void loadDuel(last.id); }
          }}>🏆 Ver mi último resultado</button>
        )}
        {invites.length > 0 && (
          <section className="math-event-incoming mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <strong>Te retaron</strong>
            {invites.map((d: any) => (
              <div
                key={d.id}
                className="mt-3 rounded-xl border border-amber-200/70 bg-white/70 p-3"
              >
                <div className="min-w-0 flex-1 text-sm">
                  <strong>{avatarGlyph[d.opponent.avatarCode] || "⭐"}{" "}
                  {d.opponent.firstName} {d.opponent.lastName} ·{" "}
                  {d.opponent.grade}.º {d.opponent.course}</strong>
                  <p className="mt-2 text-sm leading-5 text-slate-700" role="status">{d.invitationMessage || "Puedes aceptar este reto."}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    onClick={() => respond(d.id, false)}
                    className="min-h-11 rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40"
                  >
                    Rechazar reto
                  </button>
                  <button
                    disabled={busy || d.canAccept === false}
                    onClick={() => respond(d.id, true)}
                    className="min-h-11 rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {d.waitingReason === "CLOSED" ? "Fuera de fecha" : d.canAccept === false ? "En espera" : "Aceptar y jugar"}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        {ownInvites.map((d: any) => (
          <div
            key={d.id}
            className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white p-3 text-sm text-slate-600"
          >
            <span>
              <button onClick={() => setStageId(d.id)} className="text-left font-bold text-blue-800">Ver reto contra {d.opponent.firstName} →</button>
              <span className="mt-1 block text-xs leading-5">{d.invitationMessage || "Esperando respuesta. Tu reto sigue pendiente."}</span>
            </span>
            <button
              disabled={busy}
              onClick={() => cancelInvite(d.id)}
              className="shrink-0 rounded-lg border px-3 py-2 text-xs font-bold"
            >
              Cancelar
            </button>
          </div>
        ))}
        <nav className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-white p-1.5 shadow-sm">
          {(
            [
              ["play", "Jugar"],
              ["ranking", "Ranking"],
              ["profile", "Mi perfil"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`min-h-11 rounded-xl text-sm font-bold ${tab === k ? "bg-blue-700 text-white" : "text-slate-600"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === "play" && (
          <section className="mt-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Tu avatar
                  </p>
                  <p className="mt-1 font-bold">
                    {avatarGlyph[board.me.avatarCode]} {board.me.firstName}{" "}
                    {board.me.lastName} · {board.me.grade}.º {board.me.course}
                  </p>
                </div>
                <select
                  aria-label="Elegir avatar"
                  value={board.me.avatarCode}
                  onChange={(e) => changeAvatar(e.target.value)}
                  className="min-h-11 max-w-full rounded-xl border p-2 text-base"
                >
                  {avatars.map((a) => (
                    <option key={a} value={a}>
                      {avatarGlyph[a]} {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              disabled={
                busy ||
                board.me.matchesRemaining < 1 ||
                !board.roster.some((x) => x.available)
              }
              onClick={() => play("", "MATCH")}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 font-black text-white shadow-md disabled:opacity-45"
            >
              <Swords size={19} />
              {busy ? "Buscando…" : "Buscar rival disponible"}
            </button>
            <h2 className="mb-2 mt-6 text-lg font-black">
              ¿Con quién quieres jugar?
            </h2>
            <div className="space-y-2">
              {board.roster.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 shadow-sm transition-colors ${p.available ? "border-emerald-100 bg-emerald-50" : "border-white bg-white"}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 text-2xl">
                    {avatarGlyph[p.avatarCode] || "⭐"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">
                      {p.firstName} {p.lastName}
                    </strong>
                    <span className="text-xs text-slate-500">
                      {p.grade}.º · {p.course} ·{" "}
                      {p.available
                        ? "🟢 Disponible"
                        : p.inMatch
                          ? "🟠 En partida"
                          : p.hasPendingInvite ? "✉️ Reto pendiente" : "⚪ Ahora no"}
                    </span>
                  </div>
                  <button
                    disabled={
                      busy || p.inMatch || board.me.matchesRemaining < 1
                    }
                    onClick={() => play(p.id)}
                    className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-sm font-extrabold text-white disabled:bg-slate-200 disabled:text-slate-500"
                  >
                    <Swords size={16} /> Retar
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === "ranking" && (
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  ["general", "General"],
                  ["grade", "Mi grado"],
                  ["course", "Mi curso"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setScope(v)}
                  className={`min-h-10 rounded-lg text-xs font-bold ${scope === v ? "bg-blue-700 text-white" : "text-slate-600"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <div className="ranking-reaction-tools">
              <p>Reconoce una buena partida con una reacción.</p>
              <button type="button" onClick={audio.toggleEffects} aria-pressed={audio.effects}>{audio.effects ? "🔊" : "🔇"} Efectos {audio.effects ? "sí" : "no"}</button>
            </div>
            <RecognitionSummary counts={recognitions[board.me.enrollmentId]?.reactions ?? ranking?.myRecognitions} />
            {ranking && !ranking.myRank && <p className="mt-3 text-xs text-slate-600">Completa un duelo para poder reaccionar a tus compañeros.</p>}
            {ranking?.rows?.map((r: any, i: number) => (
              <div
                key={r.id}
                className={`mt-2 flex flex-wrap items-center gap-3 rounded-xl p-3 ${r.isMe ? "bg-blue-50 ring-1 ring-blue-200" : "bg-slate-50"}`}
              >
                <strong className="w-7 text-center">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : r.rank}
                </strong>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate">
                    {r.firstName} {r.lastName}
                  </strong>
                  <span className="text-xs text-slate-500">
                    {r.grade}.º · {r.course}
                  </span>
                </div>
                <strong className="text-blue-800">{r.points} pts</strong>
                <Reactions counts={recognitions[r.id]?.reactions ?? r.reactions} selected={recognitions[r.id] ? recognitions[r.id].myReaction : r.myReaction} readOnly={r.isMe} disabled={reacting || !ranking?.myRank} onReact={kind => sendReaction(r.id, kind)} />
              </div>
            ))}
            {ranking?.total === 0 && (
              <p className="py-8 text-center text-slate-500">
                La clasificación aparecerá después de las primeras partidas.
              </p>
            )}
          </section>
        )}
        {tab === "profile" && (
          <section className="mt-4 rounded-2xl bg-white p-5 text-center shadow-sm">
            <div className="text-6xl">{avatarGlyph[board.me.avatarCode]}</div>
            <h2 className="mt-2 text-xl font-black">
              {board.me.firstName} {board.me.lastName}
            </h2>
            <p className="text-sm text-slate-500">
              {board.me.grade}.º · {board.me.course}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 p-3">
                <strong className="block text-2xl">
                  {board.me.matchesUsedToday}
                </strong>
                <span className="text-xs text-slate-600">Partidas hoy</span>
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <strong className="block text-2xl">
                  {ranking?.myRank ?? "—"}
                </strong>
                <span className="text-xs text-slate-600">Puesto actual</span>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Estos puntos pertenecen a este evento. No son notas ni XP
              académico.
            </p>
          </section>
        )}
      </div>
      {stageId && (() => {
        const entry = board.duels.find(d => d.id === stageId);
        const currentDuel = duel?.id === stageId ? duel : null;
        const opponent = entry?.opponent ?? duelOpponents.current[stageId];
        if (!opponent || (!currentDuel && entry?.status !== "INVITED")) return null;
        return <DuelStage key={`${stageId}-${currentDuel ? "active" : "waiting"}`}
          title="Reto de Matemáticas" me={board.me} waitingMessage={entry?.invitationMessage}
          opponent={board.roster.find(p => p.id === opponent.id) ?? opponent}
          glyphs={avatarGlyph} duel={currentDuel}
          feedback={feedback?.duelId === stageId ? feedback : null}
          busy={busy} answering={answering} onAnswer={submit}
          audio={audio} ranking={ranking} reacting={reacting}
          onRanking={() => { setStageId(null); setHiddenDuelId(stageId); setTab("ranking"); }}
          onReact={kind => sendReaction(opponent.id, kind)}
          opponentRanking={recognitions[opponent.id] ?? ranking?.rows?.find((r: any) => r.id === opponent.id)}
          myRecognitions={recognitions[board.me.enrollmentId]?.reactions ?? ranking?.myRecognitions}
          onContinue={() => setFeedback(null)}
          onBack={() => { setHiddenDuelId(stageId); setStageId(null); }}
          onCancel={entry?.invitedByMe ? () => cancelInvite(stageId) : undefined}
        />;
      })()}
      <footer className="math-event-footer fixed inset-x-0 bottom-0 border-t bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-600">¿Listo para jugar?</span>
          <button
            onClick={toggleAvailability}
            className={`min-h-11 rounded-xl px-4 text-sm font-extrabold ${available ? "bg-emerald-100 text-emerald-800" : "bg-blue-700 text-white"}`}
          >
            {available ? "🟢 Esperando rival" : "Activarme y recibir retos"}
          </button>
        </div>
      </footer>
    </main>
  );
}

export function MathEventOrganizer() {
  const [managed, setManaged] = useState<any[]>([]);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [showExplanations, setShowExplanations] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [banks, setBanks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    api
      .get("/math-events/banks")
      .then((r) => setBanks(r.data))
      .catch((e) => toast.error(e));
  }, []);
  useEffect(() => {
    api.get("/math-events/manage").then(r => setManaged(r.data)).catch(e => toast.error(e));
  }, []);
  const saveSettings = async () => {
    const id = editingId || eventId;
    if (!id) return;
    setLoading(true);
    try {
      await api.put(`/math-events/${id}/settings`, { showCorrectAnswers, showExplanations });
      setManaged(rows => rows.map(row => row.id === id ? { ...row, showCorrectAnswers, showExplanations } : row));
      toast.success("Configuración guardada para el evento.");
    } catch (e) { toast.error(e); } finally { setLoading(false); }
  };
  const create = async () => {
    setLoading(true);
    try {
      const startsAt = bogotaInputToIso(start),
        endsAt = bogotaInputToIso(end);
      if (!startsAt || !endsAt)
        throw new Error("Revisa las fechas del evento.");
      const r = await api.post("/math-events", {
        title,
        description,
        startsAt,
        endsAt,
        eligibleGrades: [6, 7, 8, 9, 10, 11],
        dailyMatchLimit: 25,
        showCorrectAnswers, showExplanations,
      });
      setEventId(r.data.id);
      setManaged(rows => [r.data, ...rows]);
      setMessage(
        "Evento creado como borrador. Ahora copia las preguntas seleccionadas.",
      );
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };
  const importSelected = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/math-events/${eventId}/banks/import`, {
        collectionIds: selected,
      });
      setMessage(
        `Se agregaron ${r.data.added} preguntas. Total: ${r.data.questionCount}.`,
      );
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };
  const publish = async () => {
    setLoading(true);
    try {
      await api.post(`/math-events/${eventId}/publish`);
      setMessage(
        "Evento publicado. Los estudiantes elegibles podrán entrar al comenzar la fecha.",
      );
    } catch (e) {
      toast.error(e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="mx-auto min-h-screen max-w-xl bg-slate-50 px-4 py-7">
      <Link
        to="/eventos"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"
      >
        <ArrowLeft size={16} />
        Eventos
      </Link>
      <h1 className="mt-5 text-3xl font-black">Organizar evento</h1>
      <p className="mt-1 text-sm text-slate-600">
        Evento institucional, separado de las asignaturas y las notas.
      </p>
      <section className="mt-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-black">Respuestas y explicaciones</h2>
        <label className="block text-sm font-bold">Configurar evento existente
          <select className="mt-2 min-h-12 w-full rounded-xl border px-3" value={editingId} onChange={e => {
            setEditingId(e.target.value);
            setEventId("");
            setMessage("");
            const selected = managed.find(row => row.id === e.target.value);
            setShowCorrectAnswers(selected?.showCorrectAnswers ?? true); setShowExplanations(selected?.showExplanations ?? true);
          }}><option value="">Nuevo evento</option>{managed.map(row => <option key={row.id} value={row.id}>{row.title} · {row.status}</option>)}</select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={showCorrectAnswers} onChange={e => setShowCorrectAnswers(e.target.checked)} />Mostrar la respuesta correcta después de responder</label>
        <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={showExplanations} onChange={e => setShowExplanations(e.target.checked)} />Habilitar «Ver explicación»</label>
        <p className="text-xs leading-5 text-slate-600">Para una competencia con preguntas reutilizables, desactiva ambas opciones. Los aciertos y los puntos seguirán visibles; las soluciones ocultas no se enviarán al navegador.</p>
        {(editingId || eventId) && <button disabled={loading} onClick={saveSettings} className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-bold text-white disabled:opacity-50">Guardar configuración</button>}
      </section>
      {!editingId && <>
      <div className="mt-5 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="block text-sm font-bold">
          Nombre
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Semana de Matemáticas"
            className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Descripción
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-xl border p-3 font-normal"
            rows={3}
          />
        </label>
        <label className="block text-sm font-bold">
          Comienza
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <label className="block text-sm font-bold">
          Termina
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border px-3 font-normal"
          />
        </label>
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          Participan estudiantes matriculados de sexto a undécimo. Límite: 25
          duelos puntuables por día.
        </p>
        <button
          disabled={loading || !!eventId || !title || !start || !end}
          onClick={create}
          className="min-h-12 w-full rounded-xl bg-blue-700 font-bold text-white disabled:opacity-50"
        >
          Crear borrador
        </button>
      </div>
      {eventId && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-black">Bancos institucionales de Matemáticas</h2>
          <p className="mt-1 text-sm text-slate-600">
            Se copiarán al evento para que sus preguntas vivan
            independientemente de las aulas.
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {banks.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-3 rounded-xl border p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(b.id)}
                  onChange={(e) =>
                    setSelected((x) =>
                      e.target.checked
                        ? [...x, b.id]
                        : x.filter((y) => y !== b.id),
                    )
                  }
                />
                <span className="flex-1">
                  {b.title}
                  <small className="block text-slate-500">
                    Grado {b.grade} · {b.questionCount} preguntas
                  </small>
                </span>
              </label>
            ))}
          </div>
          <button
            disabled={loading || !selected.length}
            onClick={importSelected}
            className="mt-3 min-h-12 w-full rounded-xl bg-indigo-700 font-bold text-white"
          >
            Copiar preguntas seleccionadas
          </button>
          <button
            disabled={loading}
            onClick={publish}
            className="mt-2 min-h-12 w-full rounded-xl bg-emerald-700 font-bold text-white"
          >
            Publicar evento
          </button>
        </section>
      )}
      </>}
      {message && (
        <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">
          {message}
        </p>
      )}
    </main>
  );
}
