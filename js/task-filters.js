// ============================================================================
// Aplica los filtros activos a una lista de tareas (todo en el cliente,
// ya que las tareas de un proyecto o de "mis tareas" ya están cargadas
// enteras). Los campos personalizados usan la clave "cf:<id>".
// ============================================================================
export function applyTaskFilters(tasks, activeFilters) {
  if (!activeFilters) return tasks;
  const entries = Object.entries(activeFilters).filter(([, set]) => set && set.size > 0);
  if (!entries.length) return tasks;

  return tasks.filter((t) => {
    for (const [key, set] of entries) {
      if (key === "assignee") {
        if (!t.assigneeIds || !t.assigneeIds.some((id) => set.has(id))) return false;
      } else if (key === "priority") {
        if (!set.has(t.priority)) return false;
      } else if (key === "status") {
        const statusKey = t.isComplete ? "completada" : "pendiente";
        if (!set.has(statusKey)) return false;
      } else if (key === "tags") {
        if (!t.tags || !t.tags.some((tag) => set.has(tag))) return false;
      } else if (key.startsWith("cf:")) {
        const fieldId = key.slice(3);
        const val = t.customFields ? t.customFields[fieldId] : null;
        if (!val || !set.has(val)) return false;
      }
    }
    return true;
  });
}

/** Construye las columnas de filtro disponibles para el contexto actual. */
export function buildFilterDefs({ teamMembers, tagsRegistry, project, includeStatus = true }) {
  const defs = [
    {
      key: "assignee",
      label: "Responsable",
      options: (teamMembers || []).map((m) => ({ value: m.uid, label: m.name })),
    },
    {
      key: "priority",
      label: "Prioridad",
      options: [
        { value: "urgente", label: "Urgente" },
        { value: "alta", label: "Alta" },
        { value: "media", label: "Media" },
        { value: "baja", label: "Baja" },
      ],
    },
    {
      key: "tags",
      label: "Etiquetas",
      options: (tagsRegistry || []).map((t) => ({ value: t.name, label: t.name, color: t.color })),
    },
  ];
  if (includeStatus) {
    defs.push({
      key: "status",
      label: "Estado",
      options: [
        { value: "pendiente", label: "Pendiente" },
        { value: "completada", label: "Completada" },
      ],
    });
  }
  if (project && project.customFieldDefs) {
    project.customFieldDefs.forEach((f) => {
      defs.push({
        key: `cf:${f.id}`,
        label: f.name,
        options: f.options.map((opt) => ({ value: opt, label: opt })),
      });
    });
  }
  return defs;
}
