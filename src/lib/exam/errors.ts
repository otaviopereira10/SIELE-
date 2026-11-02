/** Mensajes comprensibles para los códigos de error que devuelven las funciones de la base de datos. */
const MESSAGES: Record<string, string> = {
  not_authenticated: "Su sesión ha caducado. Vuelva a iniciar sesión.",
  forbidden: "No tiene permiso para realizar esta acción.",
  attempt_not_found: "No se encontró el intento.",
  attempt_closed: "Este intento ya está cerrado y no admite cambios.",
  attempt_locked_contact_teacher: "El intento está bloqueado. Pida a su profesora que lo desbloquee.",
  section_not_active: "Esta prueba no está activa en este momento.",
  section_not_ready: "Esta prueba todavía no está disponible.",
  another_section_active: "Termine la prueba en curso antes de empezar otra.",
  time_expired: "El tiempo de esta prueba ha terminado. Lo guardado hasta ahora se conserva.",
  navigation_back_not_allowed: "En esta prueba no se puede volver a tareas anteriores.",
  task_not_reached: "Todavía no ha llegado a esta tarea.",
  task_already_checked: "Ya comprobó esta tarea; las respuestas no se pueden cambiar.",
  max_plays_reached: "Ya ha usado todas las reproducciones permitidas de este audio.",
  media_not_found: "No se encontró el recurso de audio.",
  recording_empty: "La grabación no contiene sonido. Compruebe el micrófono y vuelva a grabar.",
  recording_not_in_storage: "La grabación no llegó al servidor. Vuelva a intentar la subida.",
  recording_size_mismatch: "La grabación subida está incompleta. Vuelva a intentarlo.",
  recording_already_submitted: "Ya envió una grabación para esta pregunta.",
  recording_required: "Faltan grabaciones por repetir en esta tarea.",
  invalid_recording_path: "La ruta de la grabación no es válida.",
  choice_already_made: "Ya eligió una opción en esta parte.",
  too_many_selections: "Ha seleccionado más opciones de las permitidas.",
  assignment_not_found: "No tiene acceso a este simulacro.",
  assignment_not_open: "Este simulacro todavía no está abierto.",
  assignment_closed: "El plazo de este simulacro ha terminado.",
  max_attempts_reached: "Ha alcanzado el número máximo de intentos.",
  only_students_can_start_attempts: "Solo las cuentas de estudiante pueden realizar simulacros.",
  feedback_not_enabled: "La corrección inmediata no está habilitada en este simulacro.",
  attempt_not_submitted: "El intento todavía no se ha enviado.",
  attempt_not_ready_for_publication: "Hay una nueva entrega pendiente: podrá publicar cuando el estudiante la envíe.",
  cannot_annul_published_attempt: "No se puede anular un intento con resultados publicados.",
  no_rubric_configured: "No hay ninguna rúbrica publicada para esta prueba.",
  invalid_band: "La banda debe estar entre 0 y 5.",
  version_locked: "Las versiones publicadas no se pueden modificar. Duplique la versión para editarla.",
  cannot_remove_last_admin: "No se puede retirar el último administrador.",
  cannot_deactivate_self: "No puede desactivar su propia cuenta.",
  invalid_invitation: "El código de invitación no es válido, ha caducado o ya se usó.",
  resubmission_only_for_productive: "Solo se puede solicitar una nueva entrega en las tareas escritas y orales.",
  resubmission_only_for_writing: "Para pedir nuevas grabaciones hay que actualizar la base de datos: ejecute atualizar-banco.bat.",
  no_open_resubmission: "No hay ninguna nueva entrega pendiente en esta tarea.",
  reason_required: "Indique el motivo.",
  text_too_long: "El texto es demasiado largo.",
};

/** Rechazos que cierran la edición: no tiene sentido reintentar, hay que refrescar el estado del intento. */
const CLOSED = new Set(["time_expired", "section_not_active", "attempt_closed", "navigation_back_not_allowed", "task_already_checked", "attempt_locked_contact_teacher"]);

function rawMessage(error: unknown): string {
  if (typeof error === "string") return error;
  return error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error ?? "");
}

function rawCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code ?? "") : "";
}

export function isNetworkError(error: unknown): boolean {
  return /Failed to fetch|NetworkError|network|Load failed|fetch failed/i.test(rawMessage(error));
}

export function isSessionError(error: unknown): boolean {
  return /JWT|not_authenticated|refresh token/i.test(rawMessage(error)) || /^PGRST30\d$/.test(rawCode(error));
}

export function errorMessage(error: unknown): string {
  const raw = rawMessage(error);
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  if (code) return MESSAGES[code];
  if (isSessionError(error)) return MESSAGES.not_authenticated;
  if (isNetworkError(error)) return "Sin conexión con el servidor. Se reintentará automáticamente.";
  if (/row-level security/i.test(raw)) return "El servidor no ha aceptado la grabación: el intento ya no admite cambios.";
  if (/maximum allowed size|exceeded/i.test(raw)) return "La grabación es demasiado grande para subirla.";
  return "No se pudo completar la operación. Inténtelo de nuevo.";
}

export function errorCode(error: unknown): string | null {
  const raw = rawMessage(error);
  return Object.keys(MESSAGES).find((k) => raw.includes(k)) ?? null;
}

export type SaveErrorKind = "network" | "session" | "closed" | "rejected" | "retry";

/**
 * Qué hacer con un cambio que el servidor no ha guardado:
 * - network y session: se conserva y se reintenta (nunca se pierde una respuesta por un corte o por una sesión caducada);
 * - closed: la prueba ya no admite cambios, se descarta y se refresca el estado;
 * - rejected: el servidor lo ha validado y lo rechaza (código propio P0001), reintentar no cambiaría nada;
 * - retry: fallo temporal del servidor, se conserva y se reintenta.
 */
export function classifySaveError(error: unknown): SaveErrorKind {
  if (isNetworkError(error)) return "network";
  if (isSessionError(error)) return "session";
  const code = errorCode(error);
  if (code && CLOSED.has(code)) return "closed";
  if (rawCode(error) === "P0001") return "rejected";
  return "retry";
}
