package com.callsheet.scheduling.service;

import com.callsheet.scheduling.api.Dtos.*;
import com.callsheet.scheduling.conflict.Conflict;
import com.callsheet.scheduling.conflict.ConflictDetector;
import com.callsheet.scheduling.conflict.ScheduleWindow;
import com.callsheet.scheduling.domain.*;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SchedulingService {

    private final ProductionRepository productions;
    private final ShootDayRepository shootDays;
    private final AssignmentRepository assignments;
    private final ConflictDetector detector;

    public SchedulingService(ProductionRepository productions, ShootDayRepository shootDays,
                             AssignmentRepository assignments, ConflictDetector detector) {
        this.productions = productions;
        this.shootDays = shootDays;
        this.assignments = assignments;
        this.detector = detector;
    }

    @Transactional(readOnly = true)
    public List<Production> listProductions() {
        return productions.findAll();
    }

    @Transactional(readOnly = true)
    public Production getProduction(Long id) {
        return productions.findById(id).orElseThrow(() -> new NotFoundException("Production", id));
    }

    public Production createProduction(CreateProduction req) {
        if (req.endDate().isBefore(req.startDate())) {
            throw new IllegalArgumentException("endDate must not be before startDate");
        }
        return productions.save(new Production(req.title(), req.startDate(), req.endDate()));
    }

    @Transactional(readOnly = true)
    public List<ShootDay> listShootDays(Long productionId) {
        getProduction(productionId);
        List<ShootDay> days = shootDays.findByProductionIdOrderByCallAt(productionId);
        days.forEach(d -> d.getAssignments().size());
        return days;
    }

    @Transactional(readOnly = true)
    public ShootDay getShootDay(Long id) {
        ShootDay day = shootDays.findById(id).orElseThrow(() -> new NotFoundException("Shoot day", id));
        day.getAssignments().size();
        day.getProduction().getTitle();
        return day;
    }

    public ShootDay createShootDay(Long productionId, CreateShootDay req) {
        Production production = getProduction(productionId);
        if (!req.wrapAt().isAfter(req.callAt())) {
            throw new IllegalArgumentException("wrapAt must be after callAt");
        }
        return shootDays.save(new ShootDay(production, req.unit(), req.locationName(),
                req.callAt(), req.wrapAt(), req.notes()));
    }

    /**
     * Reschedules a shoot day. Rejected if the client's copy is stale, or if the new times would put any
     * already-assigned crew member into a conflict.
     */
    public ShootDay updateShootDay(Long id, UpdateShootDay req) {
        ShootDay day = getShootDay(id);
        if (day.getVersion() != req.version()) {
            throw new StaleVersionException(id, req.version(), day.getVersion());
        }
        day.reschedule(req.locationName(), req.callAt(), req.wrapAt(), req.notes());
        for (Assignment a : day.getAssignments()) {
            List<Conflict> conflicts = conflictsFor(a.getCrewMemberId(), day);
            if (!conflicts.isEmpty()) {
                throw new SchedulingConflictException(a.getCrewMemberId(), conflicts);
            }
        }
        shootDays.flush();
        return day;
    }

    public Assignment assign(Long shootDayId, CreateAssignment req) {
        ShootDay day = getShootDay(shootDayId);
        boolean alreadyOnDay = day.getAssignments().stream()
                .anyMatch(a -> a.getCrewMemberId().equals(req.crewMemberId()));
        if (alreadyOnDay) {
            throw new IllegalArgumentException("%s is already assigned to this shoot day".formatted(req.crewMemberId()));
        }
        List<Conflict> conflicts = conflictsFor(req.crewMemberId(), day);
        if (!conflicts.isEmpty()) {
            throw new SchedulingConflictException(req.crewMemberId(), conflicts);
        }
        Assignment assignment = new Assignment(day, req.crewMemberId(), req.role());
        day.getAssignments().add(assignment);
        return assignments.save(assignment);
    }

    public void unassign(Long assignmentId) {
        Assignment a = assignments.findById(assignmentId)
                .orElseThrow(() -> new NotFoundException("Assignment", assignmentId));
        a.getShootDay().getAssignments().remove(a);
    }

    @Transactional(readOnly = true)
    public List<Assignment> scheduleFor(String crewMemberId) {
        return assignments.findByCrewMember(crewMemberId);
    }

    @Transactional(readOnly = true)
    public List<Conflict> check(ConflictCheckRequest req) {
        return conflictsFor(req.crewMemberId(), getShootDay(req.shootDayId()));
    }

    private List<Conflict> conflictsFor(String crewMemberId, ShootDay day) {
        ScheduleWindow candidate = window(day);
        List<ScheduleWindow> existing = assignments.findByCrewMemberBetween(crewMemberId,
                        day.getCallAt().minus(detector.minTurnaround()),
                        day.getWrapAt().plus(detector.minTurnaround()))
                .stream().map(a -> window(a.getShootDay())).toList();
        return detector.detect(candidate, existing);
    }

    private static ScheduleWindow window(ShootDay d) {
        return new ScheduleWindow(d.getId(), d.getProduction().getTitle(), d.getUnit(), d.getCallAt(), d.getWrapAt());
    }
}
