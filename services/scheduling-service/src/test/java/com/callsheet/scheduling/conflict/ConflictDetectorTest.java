package com.callsheet.scheduling.conflict;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class ConflictDetectorTest {

    private final ConflictDetector detector = new ConflictDetector(Duration.ofHours(10));

    private static ScheduleWindow day(long id, String unit, String call, String wrap) {
        return new ScheduleWindow(id, "Northern Lights", unit, LocalDateTime.parse(call), LocalDateTime.parse(wrap));
    }

    @Test
    void noExistingCommitmentsMeansNoConflicts() {
        assertThat(detector.detect(day(1, "Main", "2026-11-02T07:00", "2026-11-02T19:00"), List.of())).isEmpty();
    }

    @Test
    void overlappingUnitsAreDoubleBooked() {
        var main = day(1, "Main Unit", "2026-11-02T07:00", "2026-11-02T19:00");
        var second = day(2, "Second Unit", "2026-11-02T05:30", "2026-11-02T14:00");

        var conflicts = detector.detect(main, List.of(second));

        assertThat(conflicts).singleElement().satisfies(c -> {
            assertThat(c.type()).isEqualTo(Conflict.Type.DOUBLE_BOOKED);
            assertThat(c.with().shootDayId()).isEqualTo(2L);
            assertThat(c.message()).isEqualTo("Already booked on Northern Lights (Second Unit), Mon Nov 2, 05:30 to 14:00");
        });
    }

    @Test
    void backToBackWindowsDoNotOverlapButBreakTurnaround() {
        var morning = day(1, "Main", "2026-11-02T06:00", "2026-11-02T12:00");
        var afternoon = day(2, "Second", "2026-11-02T12:00", "2026-11-02T18:00");

        assertThat(detector.detect(afternoon, List.of(morning)))
                .singleElement()
                .extracting(Conflict::type)
                .isEqualTo(Conflict.Type.TURNAROUND_VIOLATION);
    }

    @Test
    void shortRestBeforeNextDayCallIsATurnaroundViolation() {
        var lateWrap = day(1, "Main", "2026-11-02T14:00", "2026-11-03T01:00");
        var earlyCall = day(2, "Main", "2026-11-03T07:00", "2026-11-03T19:00");

        var conflicts = detector.detect(earlyCall, List.of(lateWrap));

        assertThat(conflicts).singleElement().satisfies(c -> {
            assertThat(c.type()).isEqualTo(Conflict.Type.TURNAROUND_VIOLATION);
            assertThat(c.message()).contains("6h 00m rest");
        });
    }

    @Test
    void turnaroundIsCheckedInBothDirections() {
        var candidate = day(1, "Main", "2026-11-02T07:00", "2026-11-02T22:00");
        var nextMorning = day(2, "Main", "2026-11-03T05:00", "2026-11-03T12:00");

        assertThat(detector.detect(candidate, List.of(nextMorning)))
                .extracting(Conflict::type)
                .containsExactly(Conflict.Type.TURNAROUND_VIOLATION);
    }

    @Test
    void exactlyMinimumRestIsAllowed() {
        var first = day(1, "Main", "2026-11-02T07:00", "2026-11-02T21:00");
        var next = day(2, "Main", "2026-11-03T07:00", "2026-11-03T19:00");

        assertThat(detector.detect(next, List.of(first))).isEmpty();
    }

    @Test
    void theSameShootDayIsIgnored() {
        var d = day(1, "Main", "2026-11-02T07:00", "2026-11-02T19:00");
        assertThat(detector.detect(d, List.of(d))).isEmpty();
    }

    @Test
    void reportsEveryConflictInChronologicalOrder() {
        var candidate = day(9, "Main", "2026-11-03T07:00", "2026-11-03T19:00");
        var previousNight = day(1, "Main", "2026-11-02T12:00", "2026-11-03T00:00");
        var overlapping = day(2, "Second", "2026-11-03T10:00", "2026-11-03T15:00");

        assertThat(detector.detect(candidate, List.of(overlapping, previousNight)))
                .extracting(c -> c.with().shootDayId())
                .containsExactly(1L, 2L);
    }

    @Test
    void rejectsInvertedWindows() {
        assertThatThrownBy(() -> day(1, "Main", "2026-11-02T19:00", "2026-11-02T07:00"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
