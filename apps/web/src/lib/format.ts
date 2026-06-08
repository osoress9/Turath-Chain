import type { RelationType } from "@/lib/types"

export function formatYearDeath(year: number | null | undefined) {
  if (year == null) return "w. ? H"
  return `w. ${year} H`
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))
}

export function relationLabel(relationType: RelationType | null | undefined) {
  switch (relationType) {
    case "SHARH":
      return "شرح"
    case "MUKHTASAR":
      return "مختصر"
    case "HASHIYA":
      return "حاشية"
    case "TALKHIS":
      return "تلخيص"
    case "RELATED":
      return "مرتبط"
    default:
      return "أصل"
  }
}

export function relationTone(relationType: RelationType | null | undefined) {
  switch (relationType) {
    case "SHARH":
      return "develop"
    case "MUKHTASAR":
      return "summary"
    case "HASHIYA":
      return "develop"
    case "TALKHIS":
      return "summary"
    case "RELATED":
      return "neutral"
    default:
      return "exact"
  }
}

export function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}
