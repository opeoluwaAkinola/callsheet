package com.callsheet.scheduling.conflict;

public record Conflict(Type type, ScheduleWindow with, String message) {

    public enum Type {
        /** The crew member is already booked for an overlapping window (e.g. Main Unit and Second Unit). */
        DOUBLE_BOOKED,
        /** Not enough rest between one wrap and the next call. */
        TURNAROUND_VIOLATION
    }
}
