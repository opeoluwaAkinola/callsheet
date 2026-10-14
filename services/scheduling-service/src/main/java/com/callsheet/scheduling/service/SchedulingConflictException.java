package com.callsheet.scheduling.service;

import com.callsheet.scheduling.conflict.Conflict;
import java.util.List;

public class SchedulingConflictException extends RuntimeException {

    private final String crewMemberId;
    private final List<Conflict> conflicts;

    public SchedulingConflictException(String crewMemberId, List<Conflict> conflicts) {
        super("Crew member %s has %d scheduling conflict(s)".formatted(crewMemberId, conflicts.size()));
        this.crewMemberId = crewMemberId;
        this.conflicts = conflicts;
    }

    public String getCrewMemberId() { return crewMemberId; }
    public List<Conflict> getConflicts() { return conflicts; }
}
