package com.callsheet.scheduling.conflict;

import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Pure scheduling rules, deliberately free of Spring and JPA so they are trivially unit-testable.
 */
public class ConflictDetector {

    private static final DateTimeFormatter DAY_TIME = DateTimeFormatter.ofPattern("EEE MMM d, HH:mm", Locale.US);
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm", Locale.US);

    private final Duration minTurnaround;

    public ConflictDetector(Duration minTurnaround) {
        if (minTurnaround.isNegative()) {
            throw new IllegalArgumentException("minTurnaround must not be negative");
        }
        this.minTurnaround = minTurnaround;
    }

    public Duration minTurnaround() {
        return minTurnaround;
    }

    /**
     * Returns every rule the candidate window would break against the crew member's existing commitments.
     * Windows for the same shoot day are ignored, so re-checking an existing assignment is a no-op.
     */
    public List<Conflict> detect(ScheduleWindow candidate, List<ScheduleWindow> existing) {
        List<Conflict> conflicts = new ArrayList<>();
        existing.stream()
                .filter(w -> !Objects.equals(w.shootDayId(), candidate.shootDayId()))
                .sorted(Comparator.comparing(ScheduleWindow::callAt))
                .forEach(w -> {
                    if (candidate.overlaps(w)) {
                        conflicts.add(new Conflict(Conflict.Type.DOUBLE_BOOKED, w,
                                "Already booked on %s (%s), %s".formatted(w.productionTitle(), w.unit(), describe(w))));
                        return;
                    }
                    Duration rest = w.callAt().isBefore(candidate.callAt())
                            ? Duration.between(w.wrapAt(), candidate.callAt())
                            : Duration.between(candidate.wrapAt(), w.callAt());
                    if (rest.compareTo(minTurnaround) < 0) {
                        conflicts.add(new Conflict(Conflict.Type.TURNAROUND_VIOLATION, w,
                                "Only %dh %02dm rest next to %s (%s), %s; minimum is %dh".formatted(
                                        rest.toHours(), rest.toMinutesPart(), w.productionTitle(), w.unit(),
                                        describe(w), minTurnaround.toHours())));
                    }
                });
        return conflicts;
    }

    private static String describe(ScheduleWindow w) {
        return "%s to %s".formatted(DAY_TIME.format(w.callAt()),
                w.callAt().toLocalDate().equals(w.wrapAt().toLocalDate()) ? TIME.format(w.wrapAt()) : DAY_TIME.format(w.wrapAt()));
    }
}
