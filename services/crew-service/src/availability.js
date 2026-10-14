/** True when `date` (YYYY-MM-DD) is outside every unavailability window. ISO dates compare lexically. */
export function isAvailableOn(member, date) {
  return !(member.unavailable ?? []).some((u) => u.from <= date && date <= u.to);
}
