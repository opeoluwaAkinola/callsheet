package com.callsheet.scheduling.conflict;

import java.time.LocalDateTime;

/** A block of time a crew member is committed to, independent of persistence. */
public record ScheduleWindow(Long shootDayId, String productionTitle, String unit,
                             LocalDateTime callAt, LocalDateTime wrapAt) {

    public ScheduleWindow {
        if (!wrapAt.isAfter(callAt)) {
            throw new IllegalArgumentException("wrapAt must be after callAt");
        }
    }

    boolean overlaps(ScheduleWindow other) {
        return callAt.isBefore(other.wrapAt) && other.callAt.isBefore(wrapAt);
    }
}
